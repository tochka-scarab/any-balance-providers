﻿/**
Провайдер AnyBalance (http://any-balance-providers.googlecode.com)

Получает информацию о балансе карты, последней операции, статусе и количестве сообщений.
Использует API версии не ниже 3.

Сайт магазина: http://svyaznoy.ru
Личный кабинет: http://www.sclub.ru/
*/

function getViewState(html){
    return getParam(html, null, null, /name="__VIEWSTATE".*?value="([^"]*)"/);
}

function requestPostMultipart(url, data, headers){
	var parts = [];
	var boundary = '------WebKitFormBoundaryrceZMlz5Js39A2A6';
	for(var name in data){
		parts.push(boundary, 
		'Content-Disposition: form-data; name="' + name + '"',
		'',
		data[name]);
	}
	parts.push(boundary);
        headers = headers || {};
	headers['Content-Type'] = 'multipart/form-data; boundary=' + boundary.substr(2);
	return AnyBalance.requestPost(url, parts.join('\r\n'), headers);
}

function main () {
    if (AnyBalance.getLevel () < 3) {
        throw new AnyBalance.Error ('Для этого провайдера необходима версия программы не ниже 1.2.436. Пожалуйста, обновите программу.');
    }

    var prefs = AnyBalance.getPreferences ();
    var baseurl = 'http://www.sclub.ru/';

    checkEmpty (prefs.login, 'Введите № карты');
    checkEmpty (prefs.password, 'Введите пароль');

    // Разлогин для отладки
    //AnyBalance.requestGet ('http://www.sclub.ru/LogOut.aspx');

    // Необходимо для формирования cookie
    var html = AnyBalance.requestGet (baseurl);

    var form = getParam(html, null, null, /(<form[^>]*name="Form"[^>]*>[\s\S]*?<\/form>)/i);
    if(!form)
	throw new AnyBalance.Error('Не удалось найти форму входа, похоже, связной её спрятал. Обратитесь к автору провайдера.');

    var $form = $(form);
    var params = {};
    $form.find('input, select').each(function(index){
	var $inp = $(this);
	var id=$inp.attr('id');
	var value = $inp.attr('value');
	if(id){
		if(/tbUserName/i.test(id)){ //Это имя
			value = prefs.login;
		}else if(/tbUserPassword/i.test(id)){ //Это пароль
			value = prefs.password;
		}
	}
	var name = $inp.attr('name');
	if(!name)
		return;
	params[name] = value || '';
    });

    AnyBalance.trace ('Trying to enter selfcare at address: ' + baseurl);
    var html = requestPostMultipart (baseurl + '?AspxAutoDetectCookieSupport=1', params, {Referer: baseurl + '?AspxAutoDetectCookieSupport=1'});

    // Проверка неправильной пары логин/пароль
    var error = getParam(html, null, null, /<input[^>]*id="shouldOpenPopup"[^>]*value="(1)"/i);
    if (error)
        throw new AnyBalance.Error ("Неверный логин или пароль. Проверьте введенные данные");

    // Редирект при необходимости
    var regexp = /window.location.replace\("([^"]*)"\)/;
    var res = regexp.exec (html);
    if (res)
        html = AnyBalance.requestGet (res[1]);

    // Проверка на корректный вход
    regexp = /'\/LogOut.aspx'/;
    if (regexp.exec (html))
    	AnyBalance.trace ('It looks like we are in selfcare...');
    else {
        AnyBalance.trace ('Have not found logout... Unknown error. Please contact author.');
//        AnyBalance.trace (html);
        throw new AnyBalance.Error ('Неизвестная ошибка. Пожалуйста, свяжитесь с автором провайдера.');
    }

    var result = {success: true};

    // Владелец
    getParam (html, result, 'customer', /<a href="\/YourAccountMain.aspx">\s*<span>\s*([^<]*?)\s*</i);

    // Баланс в баллах
    getParam (html, result, 'balanceinpoints', /CurrentBalance: '(\d*)/i, [], parseInt);

    // Баланс в рублях
    getParam (html, result, 'balanceinrubles', /\(скидка (\d*)/i, [], parseInt);

    // Количество сообщений
    getParam (html, result, 'messages', /title="Мои сообщения">.*?<span>(\d*)/i, [], parseInt);


    if (AnyBalance.isAvailable ('cardnumber',
                                'pointsinlastoper')) {

        AnyBalance.trace ('Fetching account info...');

        html = AnyBalance.requestGet (baseurl + 'YourAccountMain.aspx');

        AnyBalance.trace ('Parsing account info...');
    
        // Номер карты
        getParam (html, result, 'cardnumber', /Номер карты: <nobr>([^<]*)/i);
    
        // Баллы по последней операции
        getParam (html, result, 'pointsinlastoper', /<td class="((?:positiv|negativ)-points"><span>\d*)/i, [/(positiv|negativ)-points"><span>(\d*)/, '$1$2', 'positiv', '+', 'negativ', '-']);
    }


    if (AnyBalance.isAvailable ('cardstate')) {

        AnyBalance.trace ('Fetching personal data...');

        html = AnyBalance.requestGet ('https://www.sclub.ru/PersonalCabinet/UserForm.aspx');

        AnyBalance.trace ('Parsing personal data...');
    
        // Статус карты
        getParam (html, result, 'cardstate', /Статус карты:[\s\S]*?<span[^>]*>([^<]*)/i);
    }

    AnyBalance.setResult (result);
}
