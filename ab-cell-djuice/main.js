/**
Провайдер AnyBalance (http://any-balance-providers.googlecode.com)

Djuice
Сайт оператора: http://www.djuice.ua/
Личный кабинет: https://my.djuice.com.ua/
*/

function parseMinutes(str){
  var val = parseBalance(str);
  if(isset(val)){
      val *= 60; //Переводим в секунды
      AnyBalance.trace('Parsed ' + val + ' minutes from value: ' + str);
  }
  AnyBalance.trace('Parsed ' + val + ' minutes from value: ' + str);
  return val; 
}

//------------------------------------------------------------------------------

function getToken(html){
    var token = /name="org.apache.struts.taglib.html.TOKEN"[^>]+value="([\s\S]*?)">/i.exec(html);
    if(!token)
        throw new AnyBalance.Error("Не удаётся найти код безопасности для входа. Проблемы или изменения на сайте?");
    return token[1];
}

function main(){
  var prefs = AnyBalance.getPreferences();
  var baseurl = 'https://my.djuice.ua/';
  var headers = {
    'Accept-Charset':'windows-1251,utf-8;q=0.7,*;q=0.3',
    'Accept-Language':'ru-RU,ru;q=0.8,en-US;q=0.6,en;q=0.4',
    'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; Intel Mac OS X 10.6; rv:7.0.1) Gecko/20100101 Firefox/7.0.1',
    Connection: 'keep-alive'
  };

  AnyBalance.trace('Connecting to ' + baseurl);

  var html = AnyBalance.requestGet(baseurl + 'tbmb/login_djuice/show.do', headers);
  AnyBalance.trace('Token = ' + getToken(html));

  var html = AnyBalance.requestPost(baseurl + 'tbmb/login_djuice/perform.do', {
    isSubmitted: "true",
    "org.apache.struts.taglib.html.TOKEN": getToken(html),
    user: prefs.login,
    password: prefs.password
  }, headers);
  
  var matches = html.match(/<td class="redError">([\s\S]*?)<\/td>/i);
  if(matches){
      throw new AnyBalance.Error(matches[1]);
  }
  
  AnyBalance.trace('Successfully connected');
  
  var result = {success: true};
  var str_tmp;
  
  //Тарифный план
  getParam(html, result, '__tariff', /(?:Тарифний план:|Тарифный план:)[\s\S]*?<td\s+[^>]*>(.*?)\s*<\/td>/i, replaceTagsAndSpaces, html_entity_decode);
  
  // Баланс
  getParam(html, result, 'balance', /(?:Залишок на рахунку:|Остаток на счету:)[\s\S]*?<b>(.*?)</i, replaceTagsAndSpaces, parseBalance);
  
  //Залишок хвилин для дзвінків на Киевстар
  html = sumParam(html, result, 'bonus_mins_kyiv', /(?:Залишок хвилин для дзвінків|Остаток минут для звонков)\s*(?:на Київстар|на Киевстар)[\s\S]*?<b>(.*?)</ig, replaceTagsAndSpaces, parseMinutes, true, aggregate_sum);
  //Залишок хвилин для дзвінків по Украине
  html = sumParam(html, result, 'bonus_mins_country', /(?:Залишок хвилин для дзвінків|Остаток минут для звонков)\s*(?:по Україні|по Украине)[\s\S]*?<b>(.*?)</ig, replaceTagsAndSpaces, parseMinutes, true, aggregate_sum);
  //Другие бонусные минуты
  sumParam(html, result, 'bonus_mins', /(?:Залишок хвилин для дзвінків|Остаток минут для звонков)[\s\S]*?<b>(.*?)</ig, replaceTagsAndSpaces, parseMinutes, true, aggregate_sum);
  
  //Бонусные MMS
  sumParam(html, result, 'bonus_mms', /(?:Бонусні MMS:|Бонусные MMS:)[\s\S]*?<b>(.*?)</ig, replaceTagsAndSpaces, parseBalance, aggregate_sum);
  
  //Бонусные SMS
  sumParam(html, result, 'bonus_sms', /(?:Бонусні SMS:|Бонусные SMS:)[\s\S]*?<b>(.*?)</ig, replaceTagsAndSpaces, parseBalance, aggregate_sum);
  
  //Бонусные средства
  sumParam(html, result, 'bonus_money', /(?:Бонусні кошти :|Бонусные средства:)[\s\S]*?<b>(.*?)</ig, replaceTagsAndSpaces, parseBalance, aggregate_sum);
  
  //Остаток бонусов
  sumParam(html, result, 'bonus_left', /(?:Залишок бонусів:|Остаток бонусов:)[\s\S]*?<b>(.*?)</ig, replaceTagsAndSpaces, parseBalance, aggregate_sum);
  
  //Интернет
  sumParam(html, result, 'internet', /(?:Залишок бонусного об\'єму даних:|Остаток бонусного объема данных:)[\s\S]*?<b>(.*?)</ig, replaceTagsAndSpaces, parseTraffic, aggregate_sum);
  sumParam(html, result, 'internet', /(?:Інтернет:|Интернет:)[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/ig, replaceTagsAndSpaces, parseTraffic, aggregate_sum);
  
  //Домашний Интернет
  sumParam(html, result, 'home_internet', /(?:Від послуги "Домашній .нтернет":|От услуги "Домашний .нтернет":)[\s\S]*?<b>(.*?)<[\s\S]*?>(.*?)&nbsp;</ig, replaceTagsAndSpaces, parseBalance, aggregate_sum);
  
  //Домашний Интернет действует до
  sumParam(html, result, 'home_internet_to_date', /(?:Від послуги "Домашній .нтернет":|От услуги "Домашний .нтернет":)[\s\S]*?<b>(?:.*?)<[\s\S]*?>(.*?)&nbsp;</ig, replaceTagsAndSpaces, parseDate, aggregate_min);
  
  //Срок действия номера
  getParam(html, result, 'till', /(?:Номер діє до:|Номер действует до:)[\s\S]*?<td>([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, parseDate);

  //Получим дату последнего пополнения, а также дату последнего пополнения на 40 гривен и больше + 29 дней (для срока действия пакета интернет)
  if(AnyBalance.isAvailable('lastpaydate', 'lastpaysum', 'lastpaydesc', 'paydate40end')){
      html = AnyBalance.requestGet(baseurl + 'tbmb/payment/activity/show.do');
      var allpayments = [];
      var now = new Date();
      var month = new Date(now.getFullYear(), now.getMonth(), 1);

      //Узнаем начальную дату регистрации, чтобы не запрашивать слишком далеко
      var startDate = getParam(html, null, null, /(?:предоставляется, начиная с|зв’язку надається, починаючи з)\s*<b[^>]*>([^<]*)<\/b>/i, replaceTagsAndSpaces, parseDate) || 0;
      getPayments(html, allpayments);
      var maxTries = 3;
      while(!findPayments(allpayments, result) && month.getTime() > startDate && maxTries-- > 0){
          month = new Date(month.getFullYear(), month.getMonth() - 1, 1);
          
          html = AnyBalance.requestPost(baseurl + 'tbmb/view/display_view.do', {
              'org.apache.struts.taglib.html.TOKEN': getToken(html),
              selectedDate: getDateString(month, '.'),
              fromDate: getDateString(month, '/'),
              toDate: getDateString(new Date(month.getFullYear(), month.getMonth()+1, 0), '/')
          });
          getPayments(html, allpayments);
          startDate = startDate || getParam(html, null, null, /(?:предоставляется, начиная с|зв’язку надається, починаючи з)\s*<b[^>]*>([^<]*)<\/b>/i, replaceTagsAndSpaces, parseDate) || 0;
      }
  }

  AnyBalance.setResult(result);
}

function numSize(num, size){
  var str = num + '';
  if(str.length < size){
    for(var i=str.length; i<size; ++i){
	str = '0' + str;
    }
  }
  return str;
}

function getDateString(dt, separator){
        if(!separator) separator = '.';
	return numSize(dt.getDate(), 2) + separator + numSize(dt.getMonth()+1, 2) + separator + dt.getFullYear();
}

function getPayments(html, allpayments){
    var payments = getParam(html, null, null, /<edx_table[^>]+name="Payments"[^>]*>([\s\S]*?)<\/edx_table>/i);
    if(payments){
        payments.replace(/<tr[^>]*>([\s\S]*?)<\/tr>/ig, function(str, tr){
            var date = getParam(tr, null, null, /(?:[\s\S]*?<td[^>]*>){1}([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, parseDate);
            var desc = getParam(tr, null, null, /(?:[\s\S]*?<td[^>]*>){2}([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, html_entity_decode);
            var sum = getParam(tr, null, null, /(?:[\s\S]*?<td[^>]*>){4}([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, parseBalance);
            if(!date || !sum){
                AnyBalance.trace('Could not obtain date or sum from row: ' + tr);
            }else{
                allpayments[allpayments.length] = {date: date, desc: desc, sum: sum};
            }
        });
    }
}

function findPayments(allpayments, result){
    var maxIndex = -1, maxIndex40 = -1, maxDate=0, maxDate40=0;
    for(var i=0; i<allpayments.length; ++i){
        var p = allpayments[i];
        if(p.date > maxDate){
            maxDate = p.date;
            maxIndex = i;
        }
        if(p.date > maxDate40 && p.sum >= 40){ //Если заплачено больше 40 гривен
            maxDate40 = p.date;
            maxIndex40 = i;
        }
    }

    var ret = true;
    if(AnyBalance.isAvailable('lastpaydate', 'lastpaysum', 'lastpaydesc')){
        ret = ret && maxIndex >= 0;
        if(maxIndex >= 0){
            result.lastpaydate = allpayments[maxIndex].date;
            result.lastpaysum = allpayments[maxIndex].sum;
            result.lastpaydesc = allpayments[maxIndex].desc;
        }
    }
    if(AnyBalance.isAvailable('paydate40end')){
        ret = ret && maxIndex40 >= 0;
        if(maxIndex40 >= 0)
            result.paydate40end = allpayments[maxIndex40].date + 29*86400*1000; //Пакет действует 29 дней после платежа в 40 гривен
    }
    return ret;
}
