﻿/**
Провайдер AnyBalance (http://any-balance-providers.googlecode.com)

Получает баланс, остаток дней и статус у интернет-провайдера NetByNet.

Сайт провайдера: http://www.netbynet.ru/
Личный кабинет: http://stat.netbynet.ru/
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

var replaceTagsAndSpaces = [/<[^>]*>/g, ' ', /\s{2,}/g, ' ', /^\s+|\s+$/g, '', /^"+|"+$/g, ''];
var replaceFloat = [/\s+/g, '', /,/g, '.'];

function parseBalance(text){
    var val = getParam(text.replace(/\s+/g, ''), null, null, /(-?\d[\d\s.,]*)/, replaceFloat, parseFloat);
    AnyBalance.trace('Parsing balance (' + val + ') from: ' + text);
    return val;
}

function main(){
    var prefs = AnyBalance.getPreferences();

    if (!prefs.login || prefs.login == '')
        throw new AnyBalance.Error ('Введите логин');

    if (!prefs.password || prefs.password == '')
        throw new AnyBalance.Error ('Введите пароль');

    if(prefs.region == 'voronezh')
        mainVoronezh();
    else
        mainCenter();
}

function mainCenter(){
    var prefs = AnyBalance.getPreferences();
    var baseurl = 'https://stat.netbynet.ru/';

    AnyBalance.trace ("Trying to enter selfcare at address: " + baseurl);
    var html = AnyBalance.requestPost (baseurl + "main", {
    	login: prefs.login,
        password: prefs.password
    });

    var value = html.match (/class="error"[^>]*>([^<]+)<\/span>/i);
    if (value){
        throw new AnyBalance.Error (value[1]);
    }


    AnyBalance.trace ("It looks like we are in selfcare...");

    var result = {success: true};

    AnyBalance.trace("Parsing data...");

    // Тарифный план
    // Тариф выцепить сложно, пришлось ориентироваться на запись после остатка дней
    value = html.match (/Осталось[\s\S]*?<td>(.*?)<\/td>/i);
    if (value && value[1].indexOf ('нет') == -1)
      result.__tariff = value[1];

    // Баланс
    getParam (html, result, 'balance', /class="balance".*?(-?[\d]+\.?[\d]*)/i, [], parseFloat);

    // Абонент
    getParam (html, result, 'subscriber', /Абонент[^>]*>([^<]*)/i);

    // Номер договора
    getParam (html, result, 'contract', /Договор[^\d]*([\d]+)/i, [], parseInt);

    // Расчетный период - остаток
    getParam (html, result, 'day_left', /Осталось[^\d]*([\d]+)/i, [], parseInt);

    // Статус
    getParam (html, result, 'status', /class="br fgreen">(?:<[^>]*>|)([^<]*)/i);


    if (AnyBalance.isAvailable ('promised_payment')) {

        AnyBalance.trace ("Fetching stats...");

        html = AnyBalance.requestGet(baseurl + "stats");

        AnyBalance.trace("Parsing stats...");

        // Обещанные платежи
        var promised_payments = html.match (/<li>.*?История обещанных платежей[\s\S]*?<li>/i);
        if (promised_payments) {
            getParam (promised_payments, result, 'promised_payment', /<tr>(?:[\s\S]*?< *td *>){5}[^\d]*(\d+\.?\d*)/i, [], parseFloat);
        }
    }

    AnyBalance.requestGet (baseurl + "logout");


    AnyBalance.setResult(result);
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
        if(!headers) headers = {};
	headers['Content-Type'] = 'multipart/form-data; boundary=' + boundary.substr(2);
	return AnyBalance.requestPost(url, parts.join('\r\n'), headers);
}

function mainVoronezh(){
    var prefs = AnyBalance.getPreferences();
    var baseurl = 'https://selfcare.puzzle.su/voronezh/index.php';

    AnyBalance.trace ("Trying to enter selfcare at address: " + baseurl);
    var html = requestPostMultipart (baseurl + "?", {
    	'pr[form][auto][form_save_to_link]': 0,
    	'pr[form][auto][login]': prefs.login,
    	'pr[form][auto][password]': prefs.password,
    	'pr[form][auto][form_event]': 'Войти'
    });

    if(!/\?exit=1/i.test(html)){
        var error = getParam (html, null, null, /<font[^>]+color=['"]red['"][^>]*>([\s\S]*?)<\/font>/i, replaceTagsAndSpaces);
        if (value){
            throw new AnyBalance.Error (error);
        }
        throw new AnyBalance.Error ("Не удаётся войти в личный кабинет. Сайт изменен?");
    }

    AnyBalance.trace ("It looks like we are in selfcare...");

    var result = {success: true};

    AnyBalance.trace("Parsing data...");

    // Тарифный план
    // Тариф выцепить сложно, пришлось ориентироваться на запись после остатка дней
    value = html.match (/Осталось[\s\S]*?<td>(.*?)<\/td>/i);
    if (value && value[1].indexOf ('нет') == -1)
      result.__tariff = value[1];

    // Баланс
    getParam (html, result, 'balance', /<b[^>]*>баланс:<\/b>([\s\S]*?)<br[^>]*>/i, replaceTagsAndSpaces, parseBalance);

    // Абонент
    getParam (html, result, 'subscriber', /Приветствуем Вас,([^<]*)/i, replaceTagsAndSpaces);

    // Номер договора
    getParam (html, result, 'contract', /Лицевой счет:([\s\S]*?),/i, replaceTagsAndSpaces);

    // Расчетный период - остаток
    getParam (html, result, 'day_left', /До списания абонентской платы осталось:<\/b>([\s\S]*?)<br[^>]*>/i, replaceTagsAndSpaces, parseBalance);

    // Бонусный счет 
    getParam (html, result, '__tariff', /(Бонусный счет[\s\S]*?)Баланс/i, replaceTagsAndSpaces);

    // Бонусный баланс 
    getParam (html, result, 'bonus_balance', /Бонусный счет[\s\S]*?Баланс:([^<]*)/i, replaceTagsAndSpaces, parseBalance);

    AnyBalance.setResult(result);
}

