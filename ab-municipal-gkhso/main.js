﻿/**
Провайдер AnyBalance (http://any-balance-providers.googlecode.com)

Получает информацию о платежах в ЖКХНСО 

Operator site: https://жкхнсо.рф
*/

var g_headers = {
	'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
	// 'Accept-Charset':'windows-1251,utf-8;q=0.7,*;q=0.3',
	'Accept-Language':'ru-RU,ru;q=0.8,en-US;q=0.6,en;q=0.4',
	'Connection':'keep-alive',
	'User-Agent':'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/27.0.1453.94 Safari/537.36'
};

function main(){
    var prefs = AnyBalance.getPreferences();

    var baseurl = "https://www.kvartplata.ru/",
       baseurl2 = 'https://xn--f1aijeow.xn--p1ai/';

    AnyBalance.setDefaultCharset('utf-8'); 
	
    AnyBalance.requestGet(baseurl2, g_headers);
    AnyBalance.requestGet(baseurl2 + 'office/auth/', g_headers);
    AnyBalance.requestGet(baseurl + 'room/login.action?extURL=https://xn--f1aijeow.xn--p1ai&loginLink=/office/login/&exitLink=/office/logout/', g_headers);
    AnyBalance.requestGet(baseurl + 'room/extAppLogin.action', g_headers);

    AnyBalance.setCookie("www.kvartplata.ru", "extAppExitUrl", '"https://xn--f1aijeow.xn--p1ai/office/logout/"');
    AnyBalance.setCookie("www.kvartplata.ru", "userLogin", prefs.login);

    html = AnyBalance.requestPost(baseurl + 'room/doLogin.action', {
		captchaCode:'x',
        userName:prefs.login,
        userPass:prefs.password,
        timezone: '-240'
    }, addHeaders({Referer: baseurl + 'room/login.action?extURL=https://xn--f1aijeow.xn--p1ai&loginLink=/office/login/&exitLink=/office/logout/', Origin: baseurl})); 

    var jsessionid = getParam(html, null, null, /<input[^>]+name="sessionId"[^>]+value=\"([\s\S]*?)\"/i, replaceTagsAndSpaces, html_entity_decode);
 
    if(!jsessionid){
        var error = getParam(html, null, null, /<ul[^>]+class="errorMessage"[^>]*>([\s\S]*?)<\/ul>/i, replaceTagsAndSpaces, html_entity_decode);
        if(error)
            throw new AnyBalance.Error(error);
        throw new AnyBalance.Error('Не удалось зайти в личный кабинет. Сайт изменен?');
    }

    AnyBalance.requestGet(baseurl2 + 'office/', g_headers);

    html = AnyBalance.requestGet(baseurl + 'room/main.action;jsessionid=' + jsessionid, g_headers);

    var result = {success: true};
    getParam(html, result, 'fio', /<div[^>]+class="name"[^>]*>([\s\S]*?)<\/div>/i, replaceTagsAndSpaces, html_entity_decode);
    getParam(html, result, 'adress', /<div[^>]+class="address"[^>]*>([\s\S]*?)<\/div>/i, replaceTagsAndSpaces, html_entity_decode);
    getParam(html, result, 'balance', /Предварительно начислено:([\s\S]*?)руб/i, replaceTagsAndSpaces, parseBalance);
    getParam(html, result, 'balance-pay', /Рекомендовано к оплате:([\s\S]*?)руб/i, replaceTagsAndSpaces, parseBalance);
    getParam(html, result, 'last', /<h2[^>]*>Последний платёж:<\/h2>(?:[\s\S]*?<span[^>]*>){1}([\s\S]*?)<\/span>/i, replaceTagsAndSpaces, parseBalance);
    getParam(html, result, 'date', /Суммы к оплате на ([\s\S]*?):/i, replaceTagsAndSpaces, parseDate);

    AnyBalance.setResult(result);
}
