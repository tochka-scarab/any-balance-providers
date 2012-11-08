﻿/**
Провайдер AnyBalance (http://any-balance-providers.googlecode.com)

Текущий баланс у сотового оператора Skylink.

Сайт оператора: http://www.skylink.ru/
Личный кабинет: https://www.skypoint.ru/
*/

function getParam (html, result, param, regexp, replaces, parser) {
	if (param && (param != '__tariff' && !AnyBalance.isAvailable (param)))
		return;

	var value = regexp.exec (html);
	if (value) {
		value = value[1];
		if (replaces) {
			for (var i = 0; i < replaces.length; i += 2) {
				value = value.replace (replaces[i], replaces[i+1]);
			}
		}
		if (parser)
			value = parser (value);

    if(param)
      result[param] = value;
    else
      return value
	}
}

function sumParam (html, result, param, regexp, replaces, parser, do_replace) {
	if (param && (param != '__tariff' && !AnyBalance.isAvailable (param))){
            if(do_replace)
  	        return html;
            else
                return;
	}

        var total_value;
	var html_copy = html.replace(regexp, function(str, value){
		for (var i = 0; replaces && i < replaces.length; i += 2) {
			value = value.replace (replaces[i], replaces[i+1]);
		}
		if (parser)
			value = parser (value);
                if(typeof(total_value) == 'undefined')
                	total_value = value;
                else
                	total_value += value;
                return ''; //Вырезаем то, что заматчили
        });

    if(param){
      if(typeof(total_value) != 'undefined'){
          if(typeof(result[param]) == 'undefined')
      	      result[param] = total_value;
          else 
      	      result[param] += total_value;
      }
      if(do_replace)
          return html_copy;
    }else{
      return total_value;
    }
}

var replaceTagsAndSpaces = [/<[^>]*>/g, ' ', /\s{2,}/g, ' ', /^\s+|\s+$/g, '', /^"+|"+$/g, ''];
var replaceFloat = [/\s+/g, '', /,/g, '.'];

function getViewState(html){
    return getParam(html, null, null, /name="__VIEWSTATE".*?value="([^"]*)"/);
}

function getEventValidation(html){
    return getParam(html, null, null, /name="__EVENTVALIDATION".*?value="([^"]*)"/);
}

function parseBalance(text){
    var val = getParam(text.replace(/\s+/g, ''), null, null, /(-?\d[\d\s.,]*)/, replaceFloat, parseFloat);
    AnyBalance.trace('Parsing balance (' + val + ') from: ' + text);
    return val;
}

var g_regions = {
    moscow: mainMoscow,
    uln: mainUln,
    kuban: mainKuban,
    spb: mainSpb
};

function main(){
    var prefs = AnyBalance.getPreferences();
    
    var region = prefs.region || 'moscow';
    var regionFunc = g_regions[region] || g_regions.moscow;

    AnyBalance.trace("Entering region: " + region);

    regionFunc();
}

function mainMoscow(){
    var prefs = AnyBalance.getPreferences();

    var baseurl = "https://www.skypoint.ru/";
    AnyBalance.setDefaultCharset('utf-8');

    var headers = {
        'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Charset':'windows-1251,utf-8;q=0.7,*;q=0.3',
        'Accept-Language':'ru-RU,ru;q=0.8,en-US;q=0.6,en;q=0.4',
        'Connection':'keep-alive',
        'Referer': baseurl,
    	"User-Agent":'Mozilla/5.0 (Windows NT 5.1; rv:2.0) Gecko/20100101 Firefox/4.0'
    };



    var html = AnyBalance.requestGet(baseurl + 'Account/Login.aspx?ReturnUrl=%2f', headers);
    var eventvalidation = getEventValidation(html);
    var viewstate = getViewState(html);

    html = AnyBalance.requestPost(baseurl + 'Account/Login.aspx?ReturnUrl=%2f', {
	__EVENTTARGET:'',
	__EVENTARGUMENT:'',
	__VIEWSTATE:viewstate,
	__EVENTVALIDATION:eventvalidation,
	ctl00$MainContent$txtUserName:prefs.login,
	ctl00$MainContent$WatermarContactPhone_ClientState:'',
	ctl00$MainContent$txtPassword:prefs.password,
        ctl00$MainContent$ctl00: 'Войти'
    }, headers);

    if(!/ctl00\$b[nt]{2}Login/i.test(html)){
        var error = getParam(html, null, null, /<span[^>]+class="errorPinkMessage"(?:[^>](?!display:none|visibility))*>([\s\S]*?)<\/span>/i, replaceTagsAndSpaces);
        if(error)
            throw new AnyBalance.Error(error);
        throw new AnyBalance.Error('Не удалось войти в личный кабинет. Сайт изменен или неправильный регион?');
    }

    //Надо проверить, действительно ли нас пустили в кабинет, или просто перенаправили куда-то в другой регион
    //Но проверить не могу, нет у меня учетных данных...
    //var login_marker = getParam(html, null, null, /(...)/i);
    //if(!login_marker)
    //    throw new AnyBalance.Error("Не удалось войти в личный кабинет. Неправильный регион?");

    var result = {success: true};

    getParam(html, result, 'userName', /<span[^>]+id="txtLoginName"[^>]*>([\s\S]*?)<\/span>/i, replaceTagsAndSpaces, html_entity_decode);
    getParam(html, result, 'userNum', /<span[^>]+id="ucAbonentInfo_lblLitsevoySchet"[^>]*>([\s\S]*?)<\/span>/i, replaceTagsAndSpaces, html_entity_decode);
    getParam(html, result, 'balance', /Баланс лицевого счёта[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i, replaceTagsAndSpaces, parseBalance);
    getParam(html, result, '__tariff', /<span[^>]+id="ucAbonentInfo_lblTariffPlan"[^>]*>([\s\S]*?)<\/span>/i, replaceTagsAndSpaces, html_entity_decode);

    if(AnyBalance.isAvailable('charged')){
        html = AnyBalance.requestGet(baseurl + 'AbonentCenter/Summary.aspx');
        getParam(html, result, 'charged', /<span[^>]+id="[^"]*CurrentlyUsed">([\s\S]*?)<\/span>/i, replaceTagsAndSpaces, parseBalance);
    }
    
    AnyBalance.setResult(result);
}

function mainUln(){
    var prefs = AnyBalance.getPreferences();

    var baseurl = "https://www2.skypoint.ru/login_form.aspx";
    AnyBalance.setDefaultCharset('utf-8');

    var headers = {
    	"User-Agent":'Mozilla/5.0 (Windows NT 5.1; rv:2.0) Gecko/20100101 Firefox/4.0'
    };
    
    var html = AnyBalance.requestGet(baseurl, headers);
    var eventvalidation = getEventValidation(html);
    var viewstate = getViewState(html);

    html = AnyBalance.requestPost(baseurl, {
	__EVENTTARGET:'',
	__EVENTARGUMENT:'',
	__VIEWSTATE:viewstate,
	__EVENTVALIDATION:eventvalidation,
	'ctl00$pageContent$TextBox1':prefs.login,
	'ctl00$pageContent$TextBox2':prefs.password,
	'ctl00$pageContent$ImageButton1.x':11,
	'ctl00$pageContent$ImageButton1.y':12
    }, headers
    );

    var error = getParam(html, null, null, /<span[^>]+class="err_msg"[^>]*>(.*?)<\/span>/i, replaceTagsAndSpaces, html_entity_decode);
    if(error)
        throw new AnyBalance.Error(error);

    //Надо проверить, действительно ли нас пустили в кабинет, или просто перенаправили куда-то в другой регион
    var login_marker = getParam(html, null, null, /<span[^>]+id="ctl00_abonent_number"[^>]*>Абонент: (.*?)<\/span>/i, replaceTagsAndSpaces, html_entity_decode);
    if(!login_marker)
        throw new AnyBalance.Error("Не удалось войти в личный кабинет. Неправильный регион?");

    var result = {success: true}
    
    if(AnyBalance.isAvailable('userNum')){
        result.userNum = login_marker;
    }

    getParam(html, result, 'balance', /Ваш баланс, по состоянию на [0-9.]*, составляет:[\s\S]*?(-?\d[\s\d,\.]*)/i, replaceFloat, parseFloat);
    getParam(html, result, 'traffic', /Суммарный трафик \(мб\)[\s\S]*?<td[^>]*>(-?\d[\s\d,\.]*)<\/td>/i, replaceFloat, parseFloat);

    var html = AnyBalance.requestGet('http://www2.skypoint.ru/pages/change_tarif2.aspx', headers);	
    getParam(html, result, '__tariff',  /<span[^>]+id="ctl00_pageContent_Label1"[^>]*>Ваш тарифный план:[\s\S]*?<b[^>]*>([\s\S]*?)<\/b>/i, replaceTagsAndSpaces, html_entity_decode);
    
    AnyBalance.setResult(result);
}

function mainKuban(){
    var prefs = AnyBalance.getPreferences();

    var baseurl = "http://stat.kuban.skypoint.ru/";
    AnyBalance.setDefaultCharset('windows-1251');

    var headers = {
    	"User-Agent":'Mozilla/5.0 (Windows NT 5.1; rv:2.0) Gecko/20100101 Firefox/4.0'
    };
    
    var html = AnyBalance.requestPost(baseurl + '?Action=Logon', {
	PhoneNumber:prefs.login,
	PinCode:prefs.password,
	LogOn:1
    }, headers);

    html = AnyBalance.requestGet(baseurl + '?Action=Logon');

    if(!/\?Action=Logoff/i.test(html)){
        var error = getParam(html, null, null, /<span[^>]+class="err_msg"[^>]*>(.*?)<\/span>/i, replaceTagsAndSpaces, html_entity_decode);
        if(error)
            throw new AnyBalance.Error(error);
        throw new AnyBalance.Error("Не удалось войти в личный кабинет. Возможно, неправильный логин-пароль или регион.");
    }

    var result = {success: true}
    
    getParam(html, result, 'userName', /Абонент:([\s\S]*?)<br[^>]*>/i, replaceTagsAndSpaces, html_entity_decode);
    getParam(html, result, 'userNum', /по лицевому счёту абонента[\s\S]*?<!--VALUE-->([\s\S]*?)<!--ENDVALUE-->/i, replaceTagsAndSpaces, html_entity_decode);
    getParam(html, result, 'balance', /Баланс по лицевому счёту абонента(?:[\s\S]*?<!--VALUE-->){2}([\s\S]*?)<!--ENDVALUE-->/i, replaceTagsAndSpaces, parseBalance);
    getParam(html, result, 'traffic', /израсходовано\s*<b[^>]*>\s*<!--VALUE-->([^<]*)<!--ENDVALUE-->\s*<\/b>\s*мегабайт/i, replaceTagsAndSpaces, parseBalance);
    getParam(html, result, '__tariff',  /Текущий тарифный план:[\s\S]*?<b[^>]*>([\s\S]*?)<\/b>/i, replaceTagsAndSpaces, html_entity_decode);
    sumParam(html, result, 'trafficPack',  /Баланс в Трафик(?:[\s\S]*?<td[^>]*>){2}([\s\S]*?)<\/td>/ig, replaceTagsAndSpaces, parseBalance);
    
    AnyBalance.setResult(result);
}

function mainSpb(){
    var prefs = AnyBalance.getPreferences();

    var baseurl = "https://app.spb.skylink.ru:7772/internetBalance/";
    AnyBalance.setDefaultCharset('windows-1251');

    var headers = {
    	"User-Agent":'Mozilla/5.0 (Windows NT 5.1; rv:2.0) Gecko/20100101 Firefox/4.0'
    };
    
    var html = AnyBalance.requestPost(baseurl + 'j_security_check', {
	j_username:prefs.login,
	j_password:prefs.password,
	'ctl00$pContent$ImageButton1.x':33,
	'ctl00$pContent$ImageButton1.y':5
    }, headers);

    if(!/Exit.jsp/i.test(html)){
        var error = getParam(html, null, null, /<span[^>]+class="err_msg"[^>]*>(.*?)<\/span>/i, replaceTagsAndSpaces, html_entity_decode);
        if(error)
            throw new AnyBalance.Error(error);
        throw new AnyBalance.Error("Не удалось войти в личный кабинет. Возможно, неправильный логин-пароль или регион.");
    }

    var result = {success: true}
    
    getParam(html, result, 'userName', /Контактное лицо:[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, html_entity_decode);
    getParam(html, result, 'userNum', /Номер счета:[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, html_entity_decode);
    getParam(html, result, '__tariff',  /Тарифный план:[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, html_entity_decode);
    getParam(html, result, 'trafficDay',  /Передача данных, Mб в день:[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, parseBalance);

    if(AnyBalance.isAvailable('balance', 'status', 'charged')){
        html = AnyBalance.requestGet(baseurl + 'skyServiceBalance');
        getParam(html, result, 'balance', /Баланс,[^<]*:[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, parseBalance);
        getParam(html, result, 'status', /Статус договора:[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, html_entity_decode);
        getParam(html, result, 'charged', /Начисления по договору за период\s*:[\s\S]*?Всего[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, parseBalance);
    }
    
    AnyBalance.setResult(result);
}

function html_entity_decode(str)
{
    //jd-tech.net
    var tarea=document.createElement('textarea');
    tarea.innerHTML = str;
    return tarea.value;
}

