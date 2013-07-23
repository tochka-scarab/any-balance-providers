﻿/**
Провайдер AnyBalance (http://any-balance-providers.googlecode.com)
*/

var g_headers = {
	'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
	'Accept-Charset':'windows-1251,utf-8;q=0.7,*;q=0.3',
	'Accept-Language':'ru-RU,ru;q=0.8,en-US;q=0.6,en;q=0.4',
	'Connection':'keep-alive',
	'User-Agent':'Mozilla/5.0 (BlackBerry; U; BlackBerry 9900; en-US) AppleWebKit/534.11+ (KHTML, like Gecko) Version/7.0.0.187 Mobile Safari/534.11+'
};

function main(){
    var prefs = AnyBalance.getPreferences();
    var baseurl = 'https://advmaker.net/';
    AnyBalance.setDefaultCharset('windows-1251');

	var html = AnyBalance.requestPost(baseurl + 'webmaster/', {
        'login_adv':prefs.login,
        'password_adv':prefs.password,
    }, addHeaders({Referer: baseurl + 'webmaster/'})); 

    if(!/\/exit\//i.test(html)){
        var error = getParam(html, null, null, /<div[^>]+class="t-error"[^>]*>[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/i, replaceTagsAndSpaces, html_entity_decode);
        if(error)
            throw new AnyBalance.Error(error);
        throw new AnyBalance.Error('Не удалось зайти в личный кабинет. Сайт изменен?');
    }
	
	var table = getParam(html, null, null, /(<table[\s\S]*?>[\s\S]*?<\/table>)/i, null, null);
	if(!table)
		throw new AnyBalance.Error('Не удалось зайти в личный кабинет. Сайт изменен?');
	
	var result = {success: true};
	getParam(html, result, 'balance', /Заработано на[\s\S]{15}([\s\S]*?)<\/strong>/i, null, parseBalance);
	getParam(table, result, 'click_under', /Всего:(?:[\s\S]*?<td[^>]*>){1}([\s\S]*?)<\/td>/i, null, parseBalance);
	getParam(table, result, 'slide_banner', /Всего:(?:[\s\S]*?<td[^>]*>){2}([\s\S]*?)<\/td>/i, null, parseBalance);
	getParam(table, result, 'banners', /Всего:(?:[\s\S]*?<td[^>]*>){3}([\s\S]*?)<\/td>/i, null, parseBalance);

    AnyBalance.setResult(result);
}