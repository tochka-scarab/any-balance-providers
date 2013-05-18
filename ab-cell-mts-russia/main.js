﻿/**
Провайдер AnyBalance (http://any-balance-providers.googlecode.com)

Текущий баланс у сотового оператора МТС (центр). Вход через PDA-версию.
Вдохновение почерпано у http://mtsoft.ru

Сайт оператора: http://mts.ru/
Личный кабинет: https://ip.mts.ru/SELFCAREPDA/
*/
var regions = {
	auto: "https://ip.mts.ru/SELFCAREPDA/",
	center: "https://ip.mts.ru/SELFCAREPDA/",
	primorye: "https://ihelper.dv.mts.ru/SelfCarePda/",
	nnov: "https://ip.nnov.mts.ru/selfcarepda/",
	nw: "https://ip.nw.mts.ru/SELFCAREPDA/",
	sib: "https://ip.sib.mts.ru/SELFCAREPDA/",
	ural: "https://ip.nnov.mts.ru/selfcarepda/", //Почему-то урал в конце концов переадресуется сюда
	ug: "https://ihelper.ug.mts.ru/SelfCarePda/"
};

var region_aliases = {
        eao: 'primorye',
        dv: 'primorye'
};

var regionsOrdinary = {
	auto: "https://ihelper.mts.ru/selfcare/",
	center: "https://ihelper.mts.ru/selfcare/",
	primorye: "https://ihelper.dv.mts.ru/selfcare/",
	nnov: "https://ihelper.nnov.mts.ru/selfcare/",
	nw: "https://ihelper.nw.mts.ru/selfcare/",
	sib: "https://ihelper.sib.mts.ru/selfcare/",
	ural: "https://ihelper.nnov.mts.ru/selfcare/", //Почему-то урал в конце концов переадресуется сюда
	ug: "https://ihelper.ug.mts.ru/SelfCare/"
};

function getViewState(html){
    return getParam(html, null, null, /name="__VIEWSTATE".*?value="([^"]*)"/);
}

function main(){
    var prefs = AnyBalance.getPreferences();
    if(prefs.phone && !/^\d+$/.test(prefs.phone)){
	throw new AnyBalance.Error('В качестве номера необходимо ввести 10 цифр номера, например, 9161234567, или не вводить ничего, чтобы получить информацию по основному номеру.');
    }

    if(!prefs.login)
	throw new AnyBalance.Error('Вы не ввели телефон (логин)');
    if(!prefs.password)
	throw new AnyBalance.Error('Вы не ввели пароль');

    if(prefs.type == 'lk'){
        mainLK();
    }else if(prefs.type == 'mobile'){
        mainMobile();
    }else if(prefs.type == 'ordinary'){
        mainOrdinary();
    }else{
        try{
           if(!AnyBalance.isAvailable('bonus')){
                //Мобильный помощник, только если не нужны бонусные баллы
	        mainMobile(true);
                return;
           }else{
                AnyBalance.trace('Требуются бонусные баллы, мобильный помощник не подходит...');
           }
        }catch(e){
           if(!e.allow_retry)
               throw e;
           AnyBalance.trace('С мобильным помощником проблема: ' + e.message + " Пробуем обычный...");
        }
        try{
           mainLK(true);
        }catch(e){
           if(!e.allow_retry)
               throw e;
           AnyBalance.trace('С личным кабинетам проблема: ' + e.message + " Пробуем обычный помощник...");
           mainOrdinary();
        }
    }
}

function mainMobile(allowRetry){
    try{
        AnyBalance.trace("Entering mobile internet helper...");
        
        var prefs = AnyBalance.getPreferences();
        
        if(!regions[prefs.region]){
	AnyBalance.trace("Unknown region: " + prefs.region + ", setting to auto");
            prefs.region = 'auto';
        }
        
        var baseurl = regions[prefs.region];
        
        AnyBalance.trace("Trying to enter selfcare at address: " + baseurl);
        var html = AnyBalance.requestPost(baseurl + "Security.mvc/LogOn", {
            username: prefs.login,
            password: prefs.password
        }, g_headers);
        
        var regexp=/<form .*?id="redirect-form".*?action="[^"]*?([^\/\.]+)\.mts\.ru/i, res, tmp;
        var tries = 3;
        while(tries-- > 0 && (res=regexp.exec(html))){
            //Неправильный регион. Умный мтс нас редиректит
            //Только эта скотина не всегда даёт правильную ссылку, иногда даёт такую, которая требует ещё редиректов
            //Поэтому приходится вычленять из ссылки непосредственно нужный регион
            var newReg = res[1];
        
            if(!regions[newReg])
                throw new AnyBalance.Error("mts has redirected to unknown region: " + res[1], false);
        
            baseurl = regions[newReg];
            AnyBalance.trace("Redirected, now trying to enter selfcare at address: " + baseurl);
            html = AnyBalance.requestPost(baseurl + "Security.mvc/LogOn", {
        	    username: prefs.login,
                password: prefs.password
            }, g_headers);
        }
        
        
        regexp = /Security\.mvc\/LogOff/;
        if(!regexp.exec(html)){
            //Не вошли. Сначала пытаемся найти вразумительное объяснение этому факту...
            regexp=/<ul class="operation-results-error"><li>(.*?)<\/li>/;
            if (res=regexp.exec(html)){
                throw new AnyBalance.Error(res[1], allowRetry);
            }
            
            regexp=/<title>Произошла ошибка<\/title>/;
            if(regexp.exec(html)){
                throw new AnyBalance.Error("Мобильный интернет-помощник временно недоступен." + (prefs.region == '' ? ' Попробуйте установить ваш Регион вручную в настройках провайдера.' : ''), allowRetry);
            }
            
            var error = getParam(html, null, null, /<h1>\s*Ошибка\s*<\/h1>\s*<p>(.*?)<\/p>/i);
            if(error){
                throw new AnyBalance.Error(error, allowRetry);
            }
        
            AnyBalance.trace("Have not found logOff... Unknown other error. Please contact author.");
            AnyBalance.trace(html);
            throw new AnyBalance.Error("Не удаётся войти в мобильный интернет помощник. Возможно, проблемы на сайте." + (prefs.region == '' ? ' Попробуйте установить ваш Регион вручную в настройках провайдера.' : ' Попробуйте вручную войти в помощник по адресу ' + baseurl), allowRetry);
        }
        
        AnyBalance.trace("It looks like we are in selfcare (found logOff)...");
        var result = {success: true};
        
        if(prefs.phone && prefs.phone != prefs.login){
            html = AnyBalance.requestGet(baseurl + "MyPhoneNumbers.mvc", g_headers);
            html = AnyBalance.requestGet(baseurl + "MyPhoneNumbers.mvc/Change?phoneNumber=7"+prefs.phone, g_headers);
            if(!html)
	    throw new AnyBalance.Error(prefs.phone + ": номер, возможно, неправильный или у вас нет к нему доступа", false); 
            var error = getParam(html, null, null, /<ul class="operation-results-error">([\s\S]*?)<\/ul>/i, replaceTagsAndSpaces, html_entity_decode);
            if(error)
	    throw new AnyBalance.Error(prefs.phone + ": " + error, false); 
        }
        
        // Тарифный план
        getParam(html, result, '__tariff', /Тарифный план.*?>([^<]*)/i, replaceTagsAndSpaces, html_entity_decode);
        // Баланс
        getParam (html, result, 'balance', /Баланс.*?>([-\d\.,\s]+)/i, replaceTagsAndSpaces, parseBalance);
        if(AnyBalance.isAvailable('balance') && !isset(result.balance)){
            AnyBalance.trace(html);
            throw new AnyBalance.Error('Не удалось найти баланс в мобильном помощнике!', allowRetry); 
        }

        // Телефон
        getParam (html, result, 'phone', /Ваш телефон:.*?>([^<]*)</i, replaceTagsAndSpaces, html_entity_decode);
        
        if (isAvailableStatus()) {
        
            AnyBalance.trace("Fetching status...");
        
            html = AnyBalance.requestGet(baseurl + "Account.mvc/Status", g_headers);
        
            fetchAccountStatus(html, result);
        }
        
        if (AnyBalance.isAvailable ('usedinprevmonth')) {
        
            AnyBalance.trace("Fetching history...");
        
            html = AnyBalance.requestPost (baseurl + 'Account.mvc/History', {periodIndex: 0}, g_headers);
        
            AnyBalance.trace("Parsing history...");
        
            // Расход за прошлый месяц
            getParam (html, result, 'usedinprevmonth', /За период израсходовано .*?([\d\.,]+)/i, replaceTagsAndSpaces, parseBalance);
        }
        
        
        if (AnyBalance.isAvailable ('monthlypay')) {
        
            AnyBalance.trace("Fetching traffic info...");
        
            html = AnyBalance.requestGet (baseurl + 'TariffChange.mvc', g_headers);
        
            AnyBalance.trace("Parsing traffic info...");
        
            // Ежемесячная плата
            getParam (html, result, 'monthlypay', /Ежемесячная плата[^\d]*([\d\.,]+)/i, replaceTagsAndSpaces, parseBalance);
        }
        
        AnyBalance.setResult(result);
    }catch(e){
        //Если не установлено требование другой попытки, устанавливаем его в переданное в функцию значение
        if(!isset(e.allow_retry))
            e.allow_retry = allowRetry;
        throw e; 
    }

}

var g_headers = {
    Accept:'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Charset':'windows-1251,utf-8;q=0.7,*;q=0.3',
    'Accept-Language':'ru-RU,ru;q=0.8,en-US;q=0.6,en;q=0.4',
    'Cache-Control':'max-age=0',
    Connection:'keep-alive',
    'User-Agent':'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.1 (KHTML, like Gecko) Chrome/21.0.1180.60 Safari/537.1'
};

function isInOrdinary(html){
    return /amserver\/UI\/Logout/i.test(html); 
}
function enterOrdinary(region, retVals){
    AnyBalance.trace("Entering ordinary internet helper...");
    
    var prefs = AnyBalance.getPreferences();
    AnyBalance.setDefaultCharset('utf-8');

    if(!regionsOrdinary[region]){
	AnyBalance.trace("Unknown region: " + region + ", setting to auto");
        region = 'auto';
    }

    var baseurl = regionsOrdinary[region];

//    var html = AnyBalance.requestGet(baseurl, g_headers);
//    var viewstate = getViewState(html);
//    if(!viewstate)
//	throw new AnyBalance.Error('Не найдена форма входа. Процедура входа изменена или проблемы на сайте.');

    AnyBalance.trace("Trying to enter selfcare at address: " + baseurl);
    var html = AnyBalance.requestPost(baseurl + 'logon.aspx', {
            phoneNumber: '7' + prefs.login,
            password: prefs.password,
            submit: 'Go'
//        __VIEWSTATE: viewstate,
//        ctl00$MainContent$tbPhoneNumber: prefs.login,
//        ctl00$MainContent$tbPassword: prefs.password,
//        ctl00$MainContent$btnEnter: 'Войти'
    }, g_headers);
    
    var tries = 3, redirect;
    while(tries-- > 0 && 
        (redirect=getParam(html, null, null, /<form .*?id="redirect-form".*?action="[^"]*?([^\/\.]+)\.mts\.ru/i))){
        //Неправильный регион. Умный мтс нас редиректит
        //Только эта скотина не всегда даёт правильную ссылку, иногда даёт такую, которая требует ещё редиректов
        //Поэтому приходится вычленять из ссылки непосредственно нужный регион
        if(region_aliases[redirect])
            redirect = region_aliases[redirect];
        if(!regionsOrdinary[redirect])
            throw new AnyBalance.Error("МТС перенаправила на неизвестный регион: " + redirect);
	
        baseurl = regionsOrdinary[redirect];
        AnyBalance.trace("Redirected, now trying to enter selfcare at address: " + baseurl);
        html = AnyBalance.requestPost(baseurl + "logon.aspx", {
            phoneNumber: '7' + prefs.login,
            password: prefs.password,
            submit: 'Go'
        }, g_headers);
    }

    if(!isInOrdinary(html)){
        //Не вошли. Надо сначала попытаться выдать вразумительную ошибку, а только потом уже сдаться

        var error = getParam(html, null, null, /<div class="b_error">([\s\S]*?)<\/div>/, replaceTagsAndSpaces);
        if (error){
            throw new AnyBalance.Error(error);
        }
        
        var regexp=/<title>Произошла ошибка<\/title>/;
        if(regexp.exec(html)){
            throw new AnyBalance.Error("Обычный интернет-помощник временно недоступен." + (prefs.region == 'auto' ? ' Попробуйте установить ваш Регион вручную в настройках провайдера.' : ''));
        }
        
        var error = getParam(html, null, null, /<h1>\s*Ошибка\s*<\/h1>\s*<p>(.*?)<\/p>/i);
        if(error){
            throw new AnyBalance.Error(error);
        }
    
        AnyBalance.trace("Have not found logOff... Unknown other error. Please contact author.");
        AnyBalance.trace(html);
        throw new AnyBalance.Error("Не удаётся войти в обычный интернет помощник. Возможно, проблемы на сайте." + (prefs.region == 'auto' ? ' Попробуйте установить ваш Регион вручную в настройках провайдера.' : ' Попробуйте вручную войти в помощник по адресу ' + baseurl));
    }

    AnyBalance.trace("It looks like we are in selfcare (found logOff)...");

    retVals.baseurl = baseurl;
    retVals.region = region;
    return html;
}

function mainOrdinary(){
    var prefs = AnyBalance.getPreferences();
    var retVals = {};
    var html = enterOrdinary(prefs.region, retVals);
    var baseurl = retVals.baseurl;
    var region = retVals.region;
    
    fetchOrdinary(html, baseurl);
}

function fetchOrdinary(html, baseurl, resultFromLK){
    var prefs = AnyBalance.getPreferences();
    var result = resultFromLK || {success: true};

    if(prefs.phone && prefs.phone != prefs.login){
        AnyBalance.trace('Требуется другой номер. Пытаемся переключиться...');
        html = AnyBalance.requestGet(baseurl + "my-phone-numbers.aspx", g_headers);
        html = AnyBalance.requestPost(baseurl + "my-phone-numbers.aspx", {
            ctl00_sm_HiddenField:'',
            __EVENTTARGET:'ctl00$MainContent$transitionLink',
            __EVENTARGUMENT:'7' + prefs.phone,
            __VIEWSTATE: getViewState(html)
        }, g_headers);
        if(!html)
	    throw new AnyBalance.Error(prefs.phone + ": номер, возможно, неправильный или у вас нет к нему доступа"); 
        var error = getParam(html, null, null, /(<h1>Мои номера<\/h1>)/i);
        if(error)
	    throw new AnyBalance.Error(prefs.phone + ": номер, возможно, неправильный или у вас нет к нему доступа"); 
    }

    // Тарифный план
    getParam(html, result, '__tariff', /Тарифный план.*?>([^<]*)/i, replaceTagsAndSpaces, html_entity_decode);

    // Баланс
    getParam (html, result, 'balance', /<span[^>]*id="customer-info-balance[^>]*>([\s\S]*?)(?:\(|<\/span>)/i, replaceTagsAndSpaces, parseBalance);

    // Телефон
    getParam (html, result, 'phone', /Номер:.*?>([^<]*)</i, replaceTagsAndSpaces, html_entity_decode);

    if(AnyBalance.isAvailable('bonus') && !isset(result.bonus))
        result.bonus = null; //Не сбрасываем уже ранее полученное значение бонуса в 0. Может, мы получаем из помощника, потому что сдох ЛК

    // Статус блокировки, хрен с ним, на следующей странице получим лучше
    //getParam (html, result, 'statuslock', /<li[^>]*class="lock-status[^>]*>([\s\S]*?)<\/li>/i, replaceTagsAndSpaces);

    if (isAvailableStatus()) {

        AnyBalance.trace("Fetching status...");

        if(!/<h1>Состояние счета<\/h1>/i.test(html)){
            AnyBalance.trace('Не нашли заголовка "состояние счета". Заходим на account-status.aspx');
            html = AnyBalance.requestGet(baseurl + "account-status.aspx", g_headers);
        }

        fetchAccountStatus(html, result);
    }

    if(!resultFromLK)
        AnyBalance.setResult(result);
}

function isAvailableStatus(){
    return AnyBalance.isAvailable ('min_left','min_local','min_love','sms_left','mms_left','traffic_left','traffic_left_mb',
        'license','statuslock','credit','usedinthismonth', 'bonus_balance', 'min_left_mts', 'min_used_mts', 'min_used', 'debt',
        'pay_till');
}

function fetchAccountStatus(html, result){
    AnyBalance.trace("Parsing status...");
    
    // Ближайший срок истекания пакета минут
    sumParam (html, result, 'min_till', /мин\.?,?\s*действует до ([^<]*)/ig, replaceTagsAndSpaces, parseDate, aggregate_min);

    //Территория МТС (3000 минут): Осталось 0 минут
    html = sumParam (html, result, 'min_left_mts', /Территория МТС.*?: Осталось\s*([\d\.,]+)\s*мин/ig, replaceFloat, parseBalance, aggregate_sum, true);
    html = sumParam (html, result, 'min_left_mts', /Осталось\s*([\d\.,]+)\s*мин\S* на МТС/ig, replaceFloat, parseBalance, aggregate_sum, true);
    html = sumParam (html, result, 'min_left_mts', /Остаток:?\s*([\d\.,]+)\s*мин\S* на МТС/ig, replaceFloat, parseBalance, aggregate_sum, true);

    //Срочный контракт (15%, 25% как 15%): Осталось 0 минут
    html = sumParam (html, result, 'min_left', /Срочный контракт.*?: Осталось\s*([\d\.,]+)\s*мин/ig, replaceTagsAndSpaces, parseBalance, aggregate_sum, true);

    // Пакет минут
    html = sumParam (html, result, 'min_left', /Остаток пакета минут:\s*([\d\.,]+)\s*[\.,<]/ig, replaceTagsAndSpaces, parseBalance, aggregate_sum, true);
    
    // Остаток бонуса
    html = sumParam (html, result, 'min_left', /Остаток бонуса:\s*([\d\.,]+?)\s*мин/ig, replaceTagsAndSpaces, parseBalance, aggregate_sum, true);

    // Остаток минут
    html = sumParam (html, result, 'min_left', /Осталось:?\s*([\d\.,]+)\s*мин/ig, replaceTagsAndSpaces, parseBalance, aggregate_sum, true);
    
    // Пакет минут Готовый офис: Остаток 149 минут
    // Остаток: минут
    html = sumParam (html, result, 'min_left', /Остаток:?\s*([\d\.,]+)\s*мин/ig, replaceTagsAndSpaces, parseBalance, aggregate_sum, true);

    // Остаток минут по тарифу "Готовый офис" - 194 минут
    html = sumParam (html, result, 'min_left', /Остаток мин.*?([\d\.,]+)\s*мин/ig, replaceTagsAndSpaces, parseBalance, aggregate_sum, true);

    // Остаток ежемесячных пакетов: 392 минут
    html = sumParam (html, result, 'min_left', /Остаток ежемесячных пакетов\s*(?:минут\s*)?:?\s*([\d\.,]+)\s*мин/ig, replaceTagsAndSpaces, parseBalance, aggregate_sum, true);

    // Остаток ежемесячного пакета: 296 мин
    html = sumParam (html, result, 'min_left', /Остаток ежемесячного пакета\s*(?:минут\s*)?:?\s*([\d\.,]+)\s*мин/ig, replaceTagsAndSpaces, parseBalance, aggregate_sum, true);

    // Остаток пакета: 24 минут
    html = sumParam (html, result, 'min_left', /Остаток пакета:?\s*([\d\.,]+)\s*мин/ig, replaceTagsAndSpaces, parseBalance, aggregate_sum, true);

    html = sumParam (html, result, 'min_left', /Пакет минут[^:]*:\s*Оста[^\d]*([\d\.,]+)\s*мин/ig, replaceTagsAndSpaces, parseBalance, aggregate_sum, true);

    // Подбаланс минуты: 73 мин
    html = sumParam (html, result, 'min_left', /Подбаланс минуты\s*:?\s*([\d\.,]+)\s*мин/ig, replaceTagsAndSpaces, parseBalance, aggregate_sum, true);

    // Остаток пакета минут на ТП "MAXI": 12000 секунд
    html = sumParam (html, result, 'min_left', /Остаток пакета минут[^<]*?([\d\.,]+)\s*сек/ig, replaceTagsAndSpaces, function(str){return Math.round(parseBalance(str)/60)}, aggregate_sum, true);

    // Остаток "Бесплатных вызовов при платеже": 29
    html = sumParam (html, result, 'min_left', /"Бесплатных вызовов при платеже":[^<]*?([\d\.,]+)/ig, replaceTagsAndSpaces, parseBalance, aggregate_sum, true);

    // Использовано: 0 минут местных и мобильных вызовов.
    // Использовано 1 мин на городские номера Москвы, МТС домашнего региона и МТС России
    sumParam (html, result, 'min_local', /Использовано:?\s*([\d\.,]+)\s*мин[^\s]* (местных|на городские)/ig, replaceTagsAndSpaces, parseBalance, aggregate_sum);

    // Использовано: 0 минут на любимые номера
    sumParam (html, result, 'min_love', /Использовано:?\s*([\d\.,]+)\s*мин[^\s]* на любимые/ig, replaceTagsAndSpaces, parseBalance, aggregate_sum);

    //Использовано: 17 мин на МТС России 
    sumParam (html, result, 'min_used_mts', /Использовано:?\s*(\d+)\s*мин\S* на МТС/ig, replaceTagsAndSpaces, parseBalance, aggregate_sum);

    // Остаток СМС Перезвони мне 
    html = sumParam (html, result, 'sms_left_perezvoni', /Осталось:\s*([0-5])\s*(?:sms|смс)/i, replaceTagsAndSpaces, parseBalance, aggregate_sum, true);
    // Остаток ежемесячных пакетов: 392 смс
    html = sumParam (html, result, 'sms_left', /Остаток ежемесячных пакетов\s*:?\s*([\d\.,]+)\s*(?:смс|sms)/ig, replaceTagsAndSpaces, parseBalance, aggregate_sum, true);
    // Остаток ежемесячного пакета : 98 смс
    html = sumParam (html, result, 'sms_left', /Остаток ежемесячного пакета\s*:?\s*([\d\.,]+)\s*(?:смс|sms)/ig, replaceTagsAndSpaces, parseBalance, aggregate_sum, true);
    // Остаток СМС
    html = sumParam (html, result, 'sms_left', /(?:Осталось|Остаток)(?: пакета)? (?:sms|смс):\s*(\d+)/ig, replaceTagsAndSpaces, parseBalance, aggregate_sum, true);
    // Остаток СМС
    html = sumParam (html, result, 'sms_left', /(?:Осталось|Остаток)[^\d]*(\d+)\s*(?:sms|смс)/ig, replaceTagsAndSpaces, parseBalance, aggregate_sum, true);


    // Остаток ММС
    sumParam (html, result, 'mms_left', /(?:Осталось|Остаток)(?: пакета)? (?:mms|ммс):\s*(\d+)/ig, replaceTagsAndSpaces, parseBalance, aggregate_sum);
    sumParam (html, result, 'mms_left', /(?:Осталось|Остаток)[^\d]*(\d+)\s*(?:mms|ммс)/ig, replaceTagsAndSpaces, parseBalance, aggregate_sum);

    // Накоплено 54 мин. в текущем месяце
    sumParam (html, result, 'min_used', /Накоплено\s*(\d+)\s*мин[^\s]*/g, replaceTagsAndSpaces, parseBalance, aggregate_sum);

    // Сумма по неоплаченным счетам: 786.02 руб. (оплатить до 24.03.2012)
    getParam (html, result, 'debt', /Сумма по неоплаченным счетам.*?([-\d\.,]+)/i, replaceTagsAndSpaces, parseBalance);

    // Сумма по неоплаченным счетам: 786.02 руб. (оплатить до 24.03.2012)
    getParam (html, result, 'pay_till', /оплатить до\s*([\d\.,\/]+)/i, replaceTagsAndSpaces, parseDate);

    // Остаток трафика
    getParam (html, result, 'traffic_left', /(?:Осталось|Остаток)[^\d]*(\d+[\.,]?\d* *([kmgкмг][бb]|байт|bytes))/i);
    //Подбаланс gprs: 49,26 Mb
    getParam (html, result, 'traffic_left', /Подбаланс gprs:[^\d]*(\d+[\.,]?\d*\s*([kmgкмг][бb]|байт|bytes))/i);
//    AnyBalance.trace(html);
// Остаток трафика
    sumParam (html, result, 'traffic_left_mb', /(?:Осталось|Остаток)[^\d]*(\d+[\.,]?\d* *([kmgкмг][бb]|байт|bytes))/ig, null, parseTraffic, aggregate_sum);
    //Подбаланс gprs: 49,26 Mb
    sumParam (html, result, 'traffic_left_mb', /Подбаланс gprs:[^\d]*(\d+[\.,]?\d*\s*([kmgкмг][бb]|байт|bytes))/ig, null, parseTraffic, aggregate_sum);

    // Лицевой счет
    getParam (html, result, 'license', /№([\s\S]*?)[:<]/, replaceTagsAndSpaces);

    // Блокировка
    getParam (html, result, 'statuslock', /class="account-status-lock".*>(Номер [^<]*)</i);

    // Сумма кредитного лимита
    getParam (html, result, 'credit', /(?:Лимит|Сумма кредитного лимита)[\s\S]*?([-\d\.,]+)\s*\(?руб/i, replaceTagsAndSpaces, parseBalance);

    // Расход за этот месяц
    getParam (html, result, 'usedinthismonth', /Израсходовано [^<]*?(?:<[^>]*>)?([\d\.,]+) \(?руб/i, replaceTagsAndSpaces, parseBalance);

    //Остаток бонуса 100 руб
    getParam (html, result, 'bonus_balance', /Остаток бонуса:?\s*([\d\.,]+)\s*р/i, replaceTagsAndSpaces, parseBalance);
}


function isLoggedIn(html){
    return getParam(html, null, null, /(<meta[^>]*name="lkMonitorCheck")/i);
}

function parseJson(json){
    return getJson(json);
}

function mainLK(allowRetry){
    AnyBalance.trace("Entering lk...");
    
    var prefs = AnyBalance.getPreferences();
    AnyBalance.setDefaultCharset('utf-8');

    var baseurl = 'https://lk.ssl.mts.ru';
    var baseurlLogin = 'https://login.mts.ru';

    try{
        var loginUrl = baseurlLogin + "/amserver/UI/Login?gx_charset=UTF-8&service=lk&goto=" + encodeURIComponent(baseurl + '/') + "&auth-status=0";
        if(prefs.__dbg){
            //Чтобы сбросить автологин
            var html = AnyBalance.requestGet(baseurl, g_headers);
        }else{
            //Чтобы сбросить автологин
            var html = AnyBalance.requestGet(loginUrl, g_headers);
        }
        
        if(isLoggedIn(html)){
             AnyBalance.trace("Уже залогинены, проверяем, что на правильный номер...");
             //Автоматом залогинились, надо проверить, что на тот номер
             var info = AnyBalance.requestPost(baseurl + '/GoodokServices/GoodokAjaxGetWidgetInfo/', '', g_headers);
             info = JSON.parse(info);
             if(info.MSISDN != prefs.login){  //Автоматом залогинились не на тот номер
                 AnyBalance.trace("Залогинены на неправильный номер: " + prefs.MSISDN + ", выходим");
                 html = AnyBalance.requestGet(baseurlLogin + "/amserver/UI/Logout?goto=" + encodeURIComponent(baseurl + '/'), g_headers);
             }
        }
        
        if(!isLoggedIn(html)){
            var form = getParam(html, null, null, /<form[^>]+name="Login"[^>]*>([\s\S]*?)<\/form>/i);
            if(!form)
                throw new AnyBalance.Error("Не удаётся найти форму входа!", allowRetry);
        
            var params = createFormParams(form, function(params, input, name, value){
                var undef;
                if(name == 'IDToken1')
                    value = prefs.login;
                else if(name == 'IDToken2')
                    value = prefs.password;
                else if(name == 'noscript')
                    value = undef; //Снимаем галочку
                else if(name == 'IDButton')
                    value = 'Submit';
               
                return value;
            });
        
//  //        AnyBalance.trace("Login params: " + JSON.stringify(params));
        
            AnyBalance.trace("Логинимся с заданным номером");
            html = AnyBalance.requestPost(loginUrl, params, addHeaders({Referer: loginUrl}));
//            AnyBalance.trace("Команду логина послали, смотрим, что получилось...");
        }
        
        if(!isLoggedIn(html)){
//  //        AnyBalance.trace(html);
        
            var error = getParam(html, null, null, /<div[^>]+class="field_error"[^>]*>([\s\S]*?)<\/div>/i, replaceTagsAndSpaces);
            if(error)
                throw new AnyBalance.Error(error, false);
        
            if(getParam(html, null, null, /(auth-status=0)/i))
                throw new AnyBalance.Error('Неверный логин или пароль. Повторите попытку или получите новый пароль на сайте https://lk.ssl.mts.ru/.', false);
        
            AnyBalance.trace(html);
            throw new AnyBalance.Error('Не удалось зайти в личный кабинет. Он изменился или проблемы на сайте.', allowRetry);
        }
    }catch(e){
        //Если не установлено требование другой попытки, устанавливаем его в переданное в функцию значение
        if(!isset(e.allow_retry))
            e.allow_retry = allowRetry;
        throw e; 
    }

    AnyBalance.trace("Мы в личном кабинете...");

    var result = {success: true};
//    var info = AnyBalance.requestGet(baseurlLogin + '/profile/mobile/get?callback=parseJson', g_headers);
    var info = AnyBalance.requestGet(baseurlLogin + '/profile/header?service=lk&style=2013&update', g_headers);
    getParam(info, result, 'balance', /Ваш баланс:\s*<a[^>]*>([\s\S]*?)<\/a>/i, replaceTagsAndSpaces, parseBalance);
    getParam(info, result, '__tariff', /Ваш тариф:\s*<a[^>]*>([\s\S]*?)<\/a>/i, replaceTagsAndSpaces, html_entity_decode);
    getParam(info, result, 'bonus', /Баллов:\s*<a[^>]*>([\s\S]*?)<\/a>/i, replaceTagsAndSpaces, parseBalance);
    getParam(info, result, 'phone', /<div[^>]+class="tel"[^>]*>([\s\S]*?)(?:<\/b>|<\/div>)/i, replaceTagsAndSpaces, html_entity_decode);

    if(isAvailableStatus()){
        var baseurlHelper = "https://ihelper.mts.ru/selfcare/";
        html = AnyBalance.requestGet(baseurlHelper + "account-status.aspx", g_headers);
        var redirect=getParam(html, null, null, /<form .*?id="redirect-form".*?action="[^"]*?([^\/\.]+)\.mts\.ru/);
        if (redirect){
            //Неправильный регион. Умный мтс нас редиректит
            //Только эта скотина не всегда даёт правильную ссылку, иногда даёт такую, которая требует ещё редиректов
            //Поэтому приходится вычленять из ссылки непосредственно нужный регион
            if(region_aliases[redirect])
                redirect = region_aliases[redirect];
            if(!regionsOrdinary[redirect])
                throw new AnyBalance.Error("МТС перенаправила на неизвестный регион: " + redirect);
	
            baseurlHelper = regionsOrdinary[redirect];
            AnyBalance.trace("Redirected, now trying to enter selfcare at address: " + baseurlHelper);
            html = AnyBalance.requestPost(baseurlHelper + "logon.aspx", {
                wasRedirected: '1',
                submit: 'Go'
            }, g_headers);
        }

        if(!isInOrdinary(html)){ //Тупой МТС не всегда может перейти из личного кабинета в интернет-помощник :(
            AnyBalance.trace('Ошибка прямого перехода в интернет-помощник. Пробуем зайти с логином-паролем.');
            try{
            var retVals = {};
                html = enterOrdinary(redirect, retVals);
                baseurlHelper = retVals.baseurl;
                redirect = retVals.region;
            }catch(e){
                var __message = "МТС не позволила войти в интернет-помощник из личного кабинета. Мы попытались войти в него напрямую, но не удалось: " + e.message + "\nВы можете избежать этой ошибки, отключив все счетчики, кроме баланса и бонусного баланса, или настроив вход в обычный интернет-помощник.";
                AnyBalance.trace(__message);
                AnyBalance.setResult(result);
                return;
            }
        }

        fetchOrdinary(html, baseurlHelper, result);
    }

    AnyBalance.setResult(result);
}

