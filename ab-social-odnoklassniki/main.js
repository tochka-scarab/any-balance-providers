﻿/**
Провайдер AnyBalance (http://any-balance-providers.googlecode.com)
*/

var g_headers = {
	'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
	'Accept-Charset':'windows-1251,utf-8;q=0.7,*;q=0.3',
	'Accept-Language':'ru-RU,ru;q=0.8,en-US;q=0.6,en;q=0.4',
	'Connection':'keep-alive',
	'Referer':'http://m.odnoklassniki.ru/',
	'User-Agent':'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/29.0.1547.76 Safari/537.36',
};
function main() {
	var prefs = AnyBalance.getPreferences();
	var baseurl = 'http://m.odnoklassniki.ru/';
	AnyBalance.setDefaultCharset('utf-8');
	
	if(!prefs.login)
		throw new AnyBalance.Error('Введите логин!');
	if(!prefs.password)
		throw new AnyBalance.Error('Введите пароль!');
		
	var html = AnyBalance.requestPost(baseurl + 'dk?bk=GuestMain&st.cmd=main&_prevCmd=main&tkn=9519', {
		'button_login':'Войти',
		'fr.login':prefs.login,
		'fr.needCaptcha':'',
		'fr.password':prefs.password,
		'fr.posted':'set',
    }, addHeaders({Referer: baseurl + ''}));

	if(!/cmd=logoff/i.test(html)) {
		throw new AnyBalance.Error('Не удалось зайти в личный кабинет. Сайт изменен?');
	}
	
	var href = getParam(html, null, null, /href="\/([^"]*selectBadge[^"]*)">\s*Прикрепить значок/i, replaceTagsAndSpaces, html_entity_decode);
	if(!href)
		throw new AnyBalance.Error('Не удалось найти ссылку на баланс. Сайт изменен?');
	html = AnyBalance.requestGet(baseurl + href, g_headers);

    var result = {success: true};
	getParam(html, result, 'balance', /На счёте:\s*(\d*)\s*OK/i, replaceTagsAndSpaces, parseBalance);
	
    AnyBalance.setResult(result);
}