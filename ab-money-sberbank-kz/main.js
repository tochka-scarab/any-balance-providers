﻿/**
Провайдер AnyBalance (http://any-balance-providers.googlecode.com)
*/

function getViewState(html){
    return getParam(html, null, null, /name="__VIEWSTATE".*?value="([^"]*)"/);
}

function getEventValidation(html){
    return getParam(html, null, null, /name="__EVENTVALIDATION".*?value="([^"]*)"/);
}

function parseSmallDate(str){
	//Дата
	if(str.indexOf('сегодня')!=-1) {
		var date = new Date();
		return date.getTime();
	} else if(str.indexOf('вчера')!=-1) {
		var date = new Date();
		return date.getTime()-86400000;
	} else {
                var matches = /(\d+)[^\d]+(\d+)/i.exec(str);
                if(!matches){
                    AnyBalance.trace('Не удалось распарсить дату: ' + str);
                }else{
                    var now = new Date();
                    var year = now.getFullYear();
                    if(now.getMonth()+1 < +matches[2])
                        --year; //Если текущий месяц меньше месяца последней операции, скорее всего, то было за прошлый год
                    var date = new Date(year, +matches[2]-1, +matches[1]);
                    return date.getTime();
                }
        }

}

function main() {
    var prefs = AnyBalance.getPreferences();

    var baseurl = 'https://www.sob.kz/';
    AnyBalance.setDefaultCharset('utf-8');

    if(!prefs.login)
        throw new AnyBalance.Error("Пожалуйста, укажите логин для входа в Сбербанк-Онлайн!");
    if(!prefs.password)
        throw new AnyBalance.Error("Пожалуйста, укажите пароль для входа в Сбербанк-Онлайн!");
    if(prefs.lastdigits && !/^\d{4}$/.test(prefs.lastdigits))
        throw new AnyBalance.Error("Надо указывать 4 последних цифры карты или не указывать ничего");

	html = AnyBalance.requestPost(baseurl + 'frontend/auth/login', {
		'login':prefs.login,
		'password':prefs.password,
		'AUTH_METHOD':'FAST_PWA'
    });
	// Банк просит сменить пароль
	var error = getParam(html, null, null, /Смена Пароля(?:[\s\S]*?<[^>]*>){2}([\s\S]*?)<\/div>/i, replaceTagsAndSpaces, html_entity_decode);
	if(error)
        throw new AnyBalance.Error(error);
	
/*
    error = getParam(html, null, null, /в связи с ошибкой в работе системы[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>/i, replaceTagsAndSpaces, html_entity_decode);
    if(error)
        throw new AnyBalance.Error(error);

    if(/\$\$errorFlag/i.test(html)){
        var error = getParam(html, null, null, /([\s\S]*)/, replaceTagsAndSpaces, html_entity_decode);
        throw new AnyBalance.Error(error);
    }

    var page = getParam(html, null, null, /value\s*=\s*["'](https:[^'"]*?AuthToken=[^'"]*)/i);
    if(!page){
        AnyBalance.trace(html);
        throw new AnyBalance.Error("Не удаётся найти ссылку на информацию по картам. Пожалуйста, обратитесь к автору провайдера для исправления ситуации.");
    }
*/
	if(prefs.type == 'acc')
		fetchOldAcc(html);
	else
		fetchOldCard(html , baseurl);
}

function fetchOldCard(html, baseurl){
    var prefs = AnyBalance.getPreferences();

    // Теперь ищем ссылку на карты, точнее сабмит на список карт
	var page = getParam(html, null, null, /(<form\s*id='FORM_CARD_LIST'[\s\S]*?<\/form>)/i);
	if(!page){
		throw new AnyBalance.Error("Не удаётся найти ссылку на информацию по картам. Пожалуйста, обратитесь к автору провайдера для исправления ситуации.");
	}	
	var params = createFormParams(page, null);
    html = AnyBalance.requestPost(baseurl + 'frontend/frontend', params);
	// Пока мы не знаем как выглядит счет с несколькими картами, поэтому париться им сейчас нет смысла
	var result = {success: true};
    getParam(html, result, 'cardNumber', /ibec_submit_emulator form_owwb_ws_entryCardsDoing-2_1'>([\s\S]*?),/i);
	getParam(html, result, '__tariff', /ibec_submit_emulator form_owwb_ws_entryCardsDoing-2_1'>([\s\S]*?),/i);
    getParam(html, result, 'userName', /ibec_header_right">\s*<b>([\s\S]*?)<\//i, replaceTagsAndSpaces);
	getParam(html, result, 'balance', /<item parent_id='[\s\S]*?_balance' class='ibec_balance'>\s*<content>\s*<name>([\s\S]*?)<\//i, null, parseBalance);
	getParam(html, result, 'currency', /<item parent_id='[\s\S]*?_balance' class='ibec_balance'>\s*<content>\s*<name>([\s\S]*?)<\//i, null, parseCurrency);
	
    /*getParam(html, result, 'cardName', reEngOwner, replaceTagsAndSpaces);
    getParam(html, result, 'balance', reBalanceContainer, replaceTagsAndSpaces, parseBalance);
    getParam(html, result, 'currency', reBalanceContainer, replaceTagsAndSpaces, parseCurrency);
    getParam(html, result, '__tariff', reCardNumber, replaceTagsAndSpaces);
	*/
	
    /*var lastdigits = prefs.lastdigits ? prefs.lastdigits : '\\d{4}';
    
    var baseFind = 'Мои банковские карты[\\s\\S]*?<a\\s[^>]*href="[^"]{6,}"[^>]*>[^<]*?';
    var reCard = new RegExp('Мои банковские карты[\\s\\S]*?<a\\s[^>]*href="([^"]{6,})"[^>]*>[^<]*?\\*\\*\\*' + lastdigits, 'i');
    var reCardNumber = new RegExp(baseFind + '(\\d+\\*\\*\\*' + lastdigits + ')', 'i');
    var reOwner = new RegExp(baseFind + '\\*\\*\\*' + lastdigits + '[\\s\\S]*?Владелец счета:([^<]*)', 'i');
    var reEngOwner = new RegExp(baseFind + '\\*\\*\\*' + lastdigits + '[\\s\\S]*?Клиент:([^<]*)', 'i');
    var reBalanceContainer = new RegExp(baseFind + '\\*\\*\\*' + lastdigits + '[\\s\\S]*?<td[^>]*>([\\S\\s]*?)<\\/td>', 'i');
    var cardref = getParam(html, null, null, reCard);
    if(!cardref)
        if(prefs.lastdigits)
          throw new AnyBalance.Error("Не удаётся найти ссылку на информацию по карте с последними цифрами " + prefs.lastdigits);
        else
          throw new AnyBalance.Error("Не удаётся найти ни одной карты");

    var thanksref = getParam(html, null, null, /"([^"]*bonus-spasibo.ru[^"]*)/i);
        
    var result = {success: true};
    getParam(html, result, 'cardNumber', reCardNumber);
    getParam(html, result, 'userName', reOwner, replaceTagsAndSpaces);
    getParam(html, result, 'cardName', reEngOwner, replaceTagsAndSpaces);
    getParam(html, result, 'balance', reBalanceContainer, replaceTagsAndSpaces, parseBalance);
    getParam(html, result, 'currency', reBalanceContainer, replaceTagsAndSpaces, parseCurrency);
    getParam(html, result, '__tariff', reCardNumber, replaceTagsAndSpaces);
    
    if(AnyBalance.isAvailable('till','status','cash','debt','minpay','electrocash','maxcredit','lastPurchDate','lastPurchSum','lastPurchPlace')){
      html = AnyBalance.requestGet('https://esk.zubsb.ru/pay/sbrf/'+cardref);
      getParam(html, result, 'till', /Срок действия:[\s\S]*?<td[^>]*>.*?по ([^<]*)/i, replaceTagsAndSpaces);
      getParam(html, result, 'status', /Статус:[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i, replaceTagsAndSpaces);
      getParam(html, result, 'cash', /Доступно наличных[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, parseBalance);
      getParam(html, result, 'debt', /Сумма задолженности[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, parseBalance);
      getParam(html, result, 'minpay', /Сумма минимального платежа[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, parseBalance);
      getParam(html, result, 'electrocash', /Доступно для покупок[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, parseBalance);
      getParam(html, result, 'maxcredit', /Лимит кредита[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, parseBalance);

      //Последняя операция
      var tr = getParam(html, null, null, /Последние операции по карте:[\s\S]*?<tr[^>]*>((?:[\s\S](?!<\/tr>))*"(?:cDebit|cCredit)"[\s\S]*?)<\/tr>/i);
      if(tr){
          getParam(tr, result, 'lastPurchDate', /(?:[\s\S]*?<td[^>]*>){1}([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, parseDate);
          getParam(tr, result, 'lastPurchSum', /(?:[\s\S]*?<td[^>]*>){4}([\s\S]*?)<\/td>/i, replaceTagsAndSpaces);
          getParam(tr, result, 'lastPurchPlace', /(?:[\s\S]*?<td[^>]*>){5}([\s\S]*?)<\/td>/i, replaceTagsAndSpaces);
      }else{
          AnyBalance.trace('Последняя операция не найдена.');
      }

    }

    if(AnyBalance.isAvailable('spasibo')){
        html = AnyBalance.requestGet(thanksref);
        getParam(html, result, 'spasibo', /Баланс:\s*<strong[^>]*>\s*([^<]*)/i, replaceTagsAndSpaces, parseBalance);
    }*/

    AnyBalance.setResult(result);
}

function fetchOldAcc(html){
	throw new AnyBalance.Error('Получение данных по счетам еще не поддерживается, свяжитесь с автором провайдера!');
    /*var prefs = AnyBalance.getPreferences();

    var countLeft = prefs.lastdigits && (20 - prefs.lastdigits.length);
    var lastdigits = prefs.lastdigits ? (countLeft >= 0 ? '\\d{' + countLeft + '}' + prefs.lastdigits : prefs.lastdigits) : '\\d{20}';
    
    var re = new RegExp('Мои счета и вклады[\\s\\S]*?(<tr[^>]*>(?:[\\s\\S](?!</tr>))*>\\s*' + lastdigits + '\\s*<[\\s\\S]*?</tr>)', 'i');
    var tr = getParam(html, null, null, re);
    if(!tr){
        if(prefs.lastdigits)
          throw new AnyBalance.Error("Не удаётся найти ссылку на информацию по счету с последними цифрами " + prefs.lastdigits);
        else
          throw new AnyBalance.Error("Не удаётся найти ни одного счета");
    }

    var result = {success: true};

    getParam(tr, result, 'cardNumber', /(\d{20})/);
    getParam(tr, result, 'balance', /(?:[\s\S]*?<td[^>]*>){2}([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, parseBalance);
    getParam(tr, result, 'currency', /(?:[\s\S]*?<td[^>]*>){2}([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, parseCurrency);
    getParam(tr, result, '__tariff', /(?:[\s\S]*?<td[^>]*>){1}([\s\S]*?)(?:<\/td>|<div)/i, replaceTagsAndSpaces);

    fetchOldThanks(html, result);

    var cardref = getParam(tr, null, null, /<a[^>]+href="([^"]*)/i, null, html_entity_decode);
    
    if(AnyBalance.isAvailable('userName')){
      html = AnyBalance.requestGet('https://esk.zubsb.ru/pay/sbrf/AccountsMain'+cardref);
      getParam(html, result, 'userName', /Владелец(?:&nbsp;|\s+)счета:[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i, replaceTagsAndSpaces);
    }

    AnyBalance.setResult(result);*/
}

function fetchOldThanks(html, result){
    var thanksref = getParam(html, null, null, /"([^"]*bonus-spasibo.ru[^"]*)/i);

    if(AnyBalance.isAvailable('spasibo')){
        html = AnyBalance.requestGet(thanksref);
        getParam(html, result, 'spasibo', /Баланс:\s*<strong[^>]*>\s*([^<]*)/i, replaceTagsAndSpaces, parseBalance);
    }
}



function doNewAccount(page){
    var html = AnyBalance.requestGet(page);
    if(/StartMobileBankRegistrationForm/i.test(html)){
        //Сбербанк хочет, чтобы вы приняли решение о подключении мобильного банка. Откладываем решение.
        html = AnyBalance.requestPost('https://online.sberbank.ru/PhizIC/login/register-mobilebank/start.do', {operation: 'skip'});
//        throw new AnyBalance.Error('Сбербанк хочет, чтобы вы приняли решение о подключении мобильного банка. Пожалуйста, зайдите в Сбербанк ОнЛ@йн через браузер и сделайте выбор.');
    }
    if(/PhizIC/.test(html)){
      return doNewAccountPhysic(html);
    }else{
      return doNewAccountEsk(html);
    }
}

function doNewAccountEsk(html){
    AnyBalance.trace('Entering esk account...');
    
    var baseurl = 'https://esk.sbrf.ru';
    //self.location.href='/esClient/Default.aspx?Page=1&qs=AuthToken=d80365e0-4bfd-41a1-80a1-b24847ae3e94&i=1'
    var page = getParam(html, null, null, /self\.location\.href\s*=\s*'([^'"]*?AuthToken=[^'"]*)/i);
    if(!page){
        AnyBalance.trace(html);
        throw new AnyBalance.Error("Не удаётся найти ссылку на информацию по картам (esk). Пожалуйста, обратитесь к автору провайдера для исправления ситуации.");
    }

    var token = getParam(page, null, null, /AuthToken=([^&]*)/i);
  
    //Переходим в лк esk (Типа логинимся автоматически)
    html = AnyBalance.requestGet(baseurl + page);
    //Зачем-то ещё логинимся 
    html = AnyBalance.requestGet(baseurl + '/esClient/_logon/MoveToCards.aspx?AuthToken='+token+'&i=1&supressNoCacheScript=1');
    
    //AnyBalance.trace(html);
    if(AnyBalance.getPreferences().type == 'acc')
        throw new AnyBalance.Error('Ваш тип личного кабинета не поддерживает просмотр счетов. Если вам кажется это неправильным, напишите автору провайдера е-мейл.');
    
    readEskCards();
}

function readEskCards(){
    var baseurl = 'https://esk.sbrf.ru';
    //Получаем карты
    var prefs = AnyBalance.getPreferences();

    AnyBalance.trace("Reading card list...");
    var html = AnyBalance.requestGet(baseurl + '/esClient/_s/CardsDepositsAccounts.aspx');
    //AnyBalance.trace(html);

    var lastdigits = prefs.lastdigits ? prefs.lastdigits : '\\d{4}';
    
    var baseFind = 'Мои банковские карты[\\s\\S]*?<a\\s[^>]*href="[^"]{6,}"[^>]*>[^<]*?';
    var reCard = new RegExp('Мои банковские карты[\\s\\S]*?<a\\s[^>]*href="([^"]{6,})"[^>]*>[^<]*?\\*\\*\\*' + lastdigits, 'i');
    var reCardNumber = new RegExp(baseFind + '(\\d+\\*\\*\\*' + lastdigits + ')', 'i');
    var reBalanceContainer = new RegExp(baseFind + '\\*\\*\\*' + lastdigits + '[\\s\\S]*?<td[^>]*>([\\S\\s]*?)<\\/td>', 'i');
    var cardref = getParam(html, null, null, reCard);
    if(!cardref)
        if(prefs.lastdigits)
          throw new AnyBalance.Error("Не удаётся найти ссылку на информацию по карте с последними цифрами " + prefs.lastdigits);
        else
          throw new AnyBalance.Error("Не удаётся найти ни одной карты");
        
    var result = {success: true};
    getParam(html, result, 'cardNumber', reCardNumber);
    getParam(html, result, 'balance', reBalanceContainer, replaceTagsAndSpaces, parseBalance);
    getParam(html, result, 'currency', reBalanceContainer, replaceTagsAndSpaces, parseCurrency);
    getParam(html, result, '__tariff', reCardNumber, replaceTagsAndSpaces);
    
    if(AnyBalance.isAvailable('userName', 'cardName', 'till','status','cash','debt','minpay','electrocash','maxcredit')){
      html = AnyBalance.requestGet(baseurl+'/esClient/_s/' + cardref);
      getParam(html, result, 'userName', /Имя держателя:[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i, replaceTagsAndSpaces);
      getParam(html, result, 'status', /Статус:[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i, replaceTagsAndSpaces);
      getParam(html, result, 'till', /Срок действия:[\s\S]*?<td[^>]*>\s*по\s*([^<\s]*)/i, replaceTagsAndSpaces);
      getParam(html, result, 'cash', /Доступно наличных[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, parseBalance);
      getParam(html, result, 'electrocash', /Доступно для покупок[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, parseBalance);
      getParam(html, result, 'debt', /Сумма задолженности[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, parseBalance);
      getParam(html, result, 'minpay', /Сумма минимального платежа[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, parseBalance);
      getParam(html, result, 'maxcredit', /Лимит кредита[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, parseBalance);
    }

    AnyBalance.setResult(result);
}

function doNewAccountPhysic(html){
    AnyBalance.trace('Entering physic account...');

    if(/confirmTitle/.test(html))
          throw new AnyBalance.Error("Ваш личный кабинет требует одноразовых паролей для входа. Пожалуйста, отмените в настройках кабинета требование одноразовых паролей при входе. Это безопасно: для совершения денежных операций требование одноразового пароля всё равно останется.");

    if(/Откроется справочник регионов, в котором щелкните по названию выбранного региона/.test(html)){
        //Тупой сбер предлагает обязательно выбрать регион оплаты. Вот навязчивость...
        //Ну просто выберем все регионы
        var baseurl = 'https://online.sberbank.ru';
        html = AnyBalance.requestPost(baseurl + '/PhizIC/region.do', {id: -1, operation: 'button.save'});
    }

    var prefs = AnyBalance.getPreferences();
    if(prefs.type == 'acc')
        fetchNewAccountAcc(html);
    else
        fetchNewAccountCard(html);
}

function fetchRates(html, result){
    getParam(html, result, 'eurPurch', new RegExp('<tr class="courseRow1">\\s+<td[^>]+>[\\s\\S]+?</td>\\s+<td[^>]+>\\s+([0-9.]+)\\s+'),null,parseFloat);
    getParam(html, result, 'eurSell', new RegExp('<tr class="courseRow1">(?:\\s+<td[^>]+>[\\s\\S]+?</td>){2}\\s+<td[^>]+>\\s+([0-9.]+)\\s+'),null,parseFloat);
    getParam(html, result, 'usdPurch', new RegExp('<tr class="courseRow2">\\s+<td[^>]+>[\\s\\S]+?</td>\\s+<td[^>]+>\\s+([0-9.]+)\\s+'),null,parseFloat);
    getParam(html, result, 'usdSell', new RegExp('<tr class="courseRow2">(?:\\s+<td[^>]+>[\\s\\S]+?</td>){2}\\s+<td[^>]+>\\s+([0-9.]+)\\s+'),null,parseFloat);
}

function fetchNewThanks(baseurl, result){
    if(AnyBalance.isAvailable('spasibo')){
        html = AnyBalance.requestGet(baseurl + '/PhizIC/private/async/loyalty.do');
        var href = getParam(html, null, null, /^\s*(https?:\/\/\S*)/i);
        if(!href){
            AnyBalance.trace('Не удаётся получить ссылку на спасибо от сбербанка: ' + html);
        }else{
            html = AnyBalance.requestGet(href);
            getParam(html, result, 'spasibo', /Баланс:\s*<strong[^>]*>\s*([^<]*)/i, replaceTagsAndSpaces, parseBalance);
        }
    }
}

function fetchNewAccountCard(html){
    var prefs = AnyBalance.getPreferences();
    var baseurl = "https://online.sberbank.ru";

    html = AnyBalance.requestGet(baseurl + '/PhizIC/private/cards/list.do');

    var lastdigits = prefs.lastdigits ? prefs.lastdigits.replace(/(\d)/g, '$1\\s*') : '(?:\\d\\s*){3}\\d';
    
    var baseFind = '<span[^>]*class="accountNumber\\b[^"]*">[^<]*' + lastdigits + '<';

    var reCardId = new RegExp(baseFind + '[\\s\\S]*?<span[^>]*class\\s*=\\s*"roundPlate[^>]*onclick\\s*=\\s*"[^"]*info.do\\?id=(\\d+)', 'i');
//    AnyBalance.trace('Пытаемся найти карту: ' + reCardId);
    var cardId = getParam(html, null, null, reCardId);
    
    if(!cardId)
        if(prefs.lastdigits)
          throw new AnyBalance.Error("Не удаётся идентификатор карты с последними цифрами " + prefs.lastdigits);
        else
          throw new AnyBalance.Error("Не удаётся найти ни одной карты");
      
    var reCardNumber = new RegExp('<span[^>]*class="accountNumber\\b[^"]*">\s*([^<]*' + lastdigits + ')<', 'i');
    var reBalance = new RegExp(baseFind + '[\\s\\S]*?<span class="data[^>]*>([^<]*)', 'i');
    
    var result = {success: true};
    getParam(html, result, 'balance', reBalance, replaceTagsAndSpaces, parseBalance);
    getParam(html, result, 'cardNumber', reCardNumber, replaceTagsAndSpaces);
    getParam(html, result, '__tariff', reCardNumber, replaceTagsAndSpaces);
    getParam(html, result, 'currency', reBalance, replaceTagsAndSpaces, parseCurrency);

    fetchRates(html, result);
    
    if(AnyBalance.isAvailable('userName', 'till', 'cash', 'electrocash')){
        html = AnyBalance.requestGet(baseurl + '/PhizIC/private/cards/detail.do?id=' + cardId);
        getParam(html, result, 'userName', /ФИО Держателя карты:[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/, replaceTagsAndSpaces);
        getParam(html, result, 'till', /Срок действия до:[\s\S]*?(\d\d\/\d{4})/, replaceTagsAndSpaces);
        getParam(html, result, 'cash', /для снятия наличных:[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/, replaceTagsAndSpaces, parseBalance);
        getParam(html, result, 'electrocash', /для покупок:[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/, replaceTagsAndSpaces, parseBalance);
    }

    fetchNewThanks(baseurl, result);

	if(AnyBalance.isAvailable('lastPurchSum') || AnyBalance.isAvailable('lastPurchPlace') || AnyBalance.isAvailable('lastPurchDate')) {
		html=AnyBalance.requestGet(baseurl+'/PhizIC/private/cards/info.do?id='+cardId);
                var tr = getParam(html, null, null, /<tr[^>]*class="ListLine0"[^>]*>([\S\s]*?)<\/tr>/i);

                if(tr){
                    getParam(tr, result, 'lastPurchDate', /(?:[\s\S]*?<td[^>]*>){2}([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, parseSmallDate);
                    if(AnyBalance.isAvailable('lastPurchSum')){
                        var credit = getParam(tr, null, null, /(?:[\s\S]*?<td[^>]*>){3}([\s\S]*?)<\/td>/i, replaceTagsAndSpaces);
                        var debet = getParam(tr, null, null, /(?:[\s\S]*?<td[^>]*>){4}([\s\S]*?)<\/td>/i, replaceTagsAndSpaces);
                        result.lastPurchSum = credit ? '+' + credit : '-' + debet;
                    }
                    getParam(tr, result, 'lastPurchPlace', /(?:[\s\S]*?<td[^>]*>){1}([\s\S]*?)<\/td>/i, replaceTagsAndSpaces);
                }else{
                    AnyBalance.trace('Не удалось найти последнюю операцию.');
                }
	}

    AnyBalance.setResult(result);
}

function fetchNewAccountAcc(html){
    var prefs = AnyBalance.getPreferences();
    var baseurl = "https://online.sberbank.ru";

    html = AnyBalance.requestGet(baseurl + '/PhizIC/private/accounts/list.do');

    var lastdigits = prefs.lastdigits ? prefs.lastdigits.replace(/(\d)/g, '$1\\s*') : '(?:\\d\\s*){3}\\d';
    
    var baseFind = '<span[^>]*class="productNumber\\b[^"]*">[^<]*' + lastdigits + '<';

    var reCardId = new RegExp(baseFind + '[\\s\\S]*?<span[^>]*class\\s*=\\s*"roundPlate[^>]*onclick\\s*=\\s*"[^"]*(?:operations|info).do\\?id=(\\d+)', 'i');
//    AnyBalance.trace('Пытаемся найти карту: ' + reCardId);
    var cardId = getParam(html, null, null, reCardId);
    
    if(!cardId)
        if(prefs.lastdigits)
          throw new AnyBalance.Error("Не удаётся идентификатор счета с последними цифрами " + prefs.lastdigits);
        else
          throw new AnyBalance.Error("Не удаётся найти ни одного счета");
      
    var reCardNumber = new RegExp('<span[^>]*class="productNumber\\b[^"]*">\s*([^<]*' + lastdigits + ')<', 'i');
    var reBalance = new RegExp(baseFind + '[\\s\\S]*?<span class="data[^>]*>([^<]*)', 'i');
    
    var result = {success: true};
    getParam(html, result, 'balance', reBalance, replaceTagsAndSpaces, parseBalance);
    getParam(html, result, 'cardNumber', reCardNumber, replaceTagsAndSpaces);
    getParam(html, result, '__tariff', new RegExp("\\?id=" + cardId + "[\\s\\S]*?<span[^>]+class=\"mainProductTitle\"[^>]*>([\\s\\S]*?)<\\/span>", "i"), replaceTagsAndSpaces);
    getParam(html, result, 'currency', reBalance, replaceTagsAndSpaces, parseCurrency);
    
    fetchRates(html, result);
    
    if(AnyBalance.isAvailable('till', 'cash')){
        html = AnyBalance.requestGet(baseurl + '/PhizIC/private/accounts/info.do?id=' + cardId);
        getParam(html, result, 'till', /Дата окончания срока действия:[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i, replaceTagsAndSpaces);
        getParam(html, result, 'cash', /Максимальная сумма снятия:[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, parseBalance);
    }

    fetchNewThanks(baseurl, result);

	if(AnyBalance.isAvailable('lastPurchSum') || AnyBalance.isAvailable('lastPurchPlace') || AnyBalance.isAvailable('lastPurchDate')) {
		html=AnyBalance.requestGet(baseurl+'/PhizIC/private/accounts/operations.do?id='+cardId);
                var tr = getParam(html, null, null, /<tr[^>]*class="ListLine0"[^>]*>([\S\s]*?)<\/tr>/i);

                if(tr){
                    getParam(tr, result, 'lastPurchDate', /(?:[\s\S]*?<td[^>]*>){2}([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, parseSmallDate);
                    if(AnyBalance.isAvailable('lastPurchSum')){
                        var credit = getParam(tr, null, null, /(?:[\s\S]*?<td[^>]*>){3}([\s\S]*?)<\/td>/i, replaceTagsAndSpaces);
                        var debet = getParam(tr, null, null, /(?:[\s\S]*?<td[^>]*>){4}([\s\S]*?)<\/td>/i, replaceTagsAndSpaces);
                        result.lastPurchSum = credit ? '+' + credit : '-' + debet;
                    }
                    getParam(tr, result, 'lastPurchPlace', /(?:[\s\S]*?<td[^>]*>){1}([\s\S]*?)<\/td>/i, replaceTagsAndSpaces);
                }else{
                    AnyBalance.trace('Не удалось найти последнюю операцию.');
                }
	}

    AnyBalance.setResult(result);
}
