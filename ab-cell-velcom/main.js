﻿/**
Провайдер AnyBalance (http://any-balance-providers.googlecode.com)

Текущий баланс у белорусского сотового оператора Velcom.

Сайт оператора: http://velcom.by/
Личный кабинет: https://internet.velcom.by/
*/

function main(){
    var prefs = AnyBalance.getPreferences();

    var baseurl = "https://internet.velcom.by/";
    AnyBalance.setDefaultCharset('windows-1251');

    var matches;
    if(!(matches = /^\+375(\d\d)(\d{7})$/.exec(prefs.login)))
	throw new AnyBalance.Error('Неверный номер телефона. Необходимо ввести номер в международном формате без пробелов и разделителей!');

    var phone = matches[2];
    var prefix = matches[1];
    
    var html = AnyBalance.requestGet(baseurl/* + 'work.html'*/);
    var sid = getParam(html, null, null, /name="sid3" value="([^"]*)"/i);
    if(!sid)
	throw new AnyBalance.Error('Не удалось найти идентификатор сессии!');
    
    var form = getParam(html, null, null, /(<form[^>]*name="mainForm"[^>]*>[\s\S]*?<\/form>)/i);
    if(!form)
	throw new AnyBalance.Error('Не удалось найти форму входа, похоже, velcom её спрятал. Обратитесь к автору провайдера.');

    var params = createFormParams(form, function(params, str, name, value){
	var id=getParam(str, null, null, /\bid="([^"]*)/i, null, html_entity_decode);
	if(id){
		if(/PRE/i.test(id)){ //Это префикс
			value = prefix;
		}else if(/NUMBER/i.test(id)){ //Это номер
			value = phone;
		}else if(/PWD/i.test(id)){ //Это пароль
			value = prefs.password;
		}
	}
	if(!name)
		return;
	if(name == 'user_input_0')
		value = '_next';
	if(name == 'user_input_timestamp')
		value = new Date().getTime();
	if(name == 'user_input_8')
		value = '5';
	if(name == 'user_input_9')
		value = '2';
	if(name == 'user_input_10')
		value = '0';
	return value || '';
    });

    var required_headers = {
		'Origin': 'https://internet.velcom.by',
		'Referer': 'https://internet.velcom.by/work.html',
		'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/535.19 (KHTML, like Gecko) Chrome/18.0.1025.162 Safari/535.19'
    };
    
    var html = requestPostMultipart(baseurl + 'work.html', params, required_headers);

    var kabinetType, personalInfo;
    if(/_root\/FIN_INFO/i.test(html)){
        personalInfo = '_root/USER_INFO';
        kabinetType = 2;
    }else if(/_root\/MENU0/i.test(html)){
        personalInfo = '_root/MENU1/USER_INFO';
        kabinetType = 1;
    }

    if(!kabinetType){
        var error = sumParam(html, null, null, /<td[^>]+class="INFO(?:_Error|_caption)?"[^>]*>(.*?)<\/td>/ig, replaceTagsAndSpaces, html_entity_decode, create_aggregate_join(' '));
        if(error)
            throw new AnyBalance.Error(error);
        throw new AnyBalance.Error('Не удалось войти в личный кабинет. Сайт изменен?');
    }

    AnyBalance.trace('Cabinet type: ' + kabinetType);

    var result = {success: true};

    var html = requestPostMultipart(baseurl + 'work.html', {
        sid3: sid,
        user_input_timestamp: new Date().getTime(),
        user_input_0: personalInfo,
        last_id: ''
    }, required_headers);
         
    getParam(html, result, 'userName', /ФИО:[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, html_entity_decode);
    getParam(html, result, 'userNum', /(?:номер клиента|Номер телефона):[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, html_entity_decode);
    getParam(html, result, 'balance', /(?:Текущий баланс|Баланс|Баланс основного счета):[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, parseBalance);
    sumParam(html, result, 'balanceBonus', /(?:Баланс бонусного счета \d):[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/ig, replaceTagsAndSpaces, parseBalance, aggregate_sum);
    getParam(html, result, 'status', /(?:Текущий статус абонента|Статус абонента):[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, html_entity_decode);
    getParam(html, result, '__tariff', /Тарифный план:[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, html_entity_decode);
    getParam(html, result, 'min', /Остаток минут, SMS, MMS, GPRS, включенных в абонплату:[\s\S]*?<td[^>]*>(?:[\s\S](?!<\/td>))*?(-?\d[\d,\.]*) мин(?:ут)?(?:\s*во все сети)?(?:,|\s*<)/i, replaceTagsAndSpaces, parseBalance);
    getParam(html, result, 'min_fn', /Остаток минут, SMS, MMS, GPRS, включенных в абонплату:[\s\S]*?<td[^>]*>(?:[\s\S](?!<\/td>))*?(-?\d[\d,\.]*) мин(?:ут)? на ЛН/i, replaceTagsAndSpaces, parseBalance);
    getParam(html, result, 'min_velcom', /Остаток минут, SMS, MMS, GPRS, включенных в абонплату:[\s\S]*?<td[^>]*>(?:[\s\S](?!<\/td>))*?(-?\d[\d,\.]*) мин(?:ут)? на velcom/i, replaceTagsAndSpaces, parseBalance);

    getParam(html, result, 'traffic', /Остаток минут, SMS, MMS, GPRS, включенных в абонплату:[\s\S]*?<td[^>]*>(?:[\s\S](?!<\/td>))*?(-?\d[\d,\.]*)\s*Мб/i, replaceTagsAndSpaces, parseBalance);
	
	if(AnyBalance.isAvailable('loan_balance', 'loan_left', 'loan_end')) {
		var html = requestPostMultipart(baseurl + 'work.html', {
			sid3: sid,
			user_input_timestamp: new Date().getTime(),
			user_input_0: '_root/MENU1/FIN_INFO1/LOAN',
			user_input_1: 'LOAN',
			last_id: ''
		}, required_headers);
		
		getParam(html, result, 'loan_balance', /Размер ежемесячного платежа:(?:[^>]*>){2}([^<]*)/i, replaceTagsAndSpaces, parseBalance);
		getParam(html, result, 'loan_left', /Оставшаяся к выплате сумма по рассрочке:(?:[^>]*>){2}([^<]*)/i, replaceTagsAndSpaces, parseBalance);
		getParam(html, result, 'loan_end', /Дата погашения рассрочки:(?:[^>]*>){2}([^<]*)/i, replaceTagsAndSpaces, parseDate);
	}
	
	/*
    if(AnyBalance.isAvailable('traffic')){
        html = requestPostMultipart(baseurl + 'work.html', {
            sid3: sid,
            user_input_timestamp: new Date().getTime(),
            user_input_0: '_root/TPLAN/PACKETS',
            last_id: '',
            user_input_1: -1
        }, required_headers);

        var packetMb = getParam(html, null, null, /Остаток интернет-трафика:[^<]*?(\d+)\s*Мб/i, replaceFloat, parseFloat) || 0;
        var packetKb = getParam(html, null, null, /Остаток интернет-трафика:[^<]*?(\d+)\s*Кб/i, replaceFloat, parseFloat) || 0;

        result.traffic = traffic + packetMb + packetKb/1000;
    }
*/    
    AnyBalance.setResult(result);
}
