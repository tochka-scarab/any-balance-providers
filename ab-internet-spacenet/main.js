﻿/**
Провайдер AnyBalance (http://any-balance-providers.googlecode.com)
*/

var g_headers = {
	'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
	'Accept-Charset': 'windows-1251,utf-8;q=0.7,*;q=0.3',
	'Accept-Language': 'ru-RU,ru;q=0.8,en-US;q=0.6,en;q=0.4',
	'Connection': 'keep-alive',
	'User-Agent': 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/29.0.1547.76 Safari/537.36',
};

function main() {
	var prefs = AnyBalance.getPreferences();
	var baseurl = 'https://bill.spacenet.ru/';
	AnyBalance.setDefaultCharset('utf-8');
	
	checkEmpty(prefs.login, 'Введите логин!');
	checkEmpty(prefs.password, 'Введите пароль!');
	
	var html = AnyBalance.requestGet(baseurl + 'general.shtml', g_headers);
	
	html = AnyBalance.requestPost(baseurl + 'general.shtml', {
		user: prefs.login,
		pass: prefs.password,
	}, addHeaders({Referer: baseurl + 'general.shtml'}));
	
	if (!/logout/i.test(html)) {
		var error = getParam(html, null, null, /Вход в личный кабинет:[^>]*>[^>]*"red"[^>]*>([^<]+)/i, replaceTagsAndSpaces, html_entity_decode);
		if (error)
			throw new AnyBalance.Error(error, null, /Неверный логин или пароль/i.test(error));
		
		throw new AnyBalance.Error('Не удалось зайти в личный кабинет. Сайт изменен?');
	}
	
	var result = {success: true};
	
	getParam(html, result, 'fio', /Зарегистрирован на:(?:[^>]*>){3}([^<]+)/i, replaceTagsAndSpaces, html_entity_decode);
	getParam(html, result, 'status', /Статус:(?:[^>]*>){2}([^<]+)/i, replaceTagsAndSpaces, html_entity_decode);
	getParam(html, result, 'balance', /Баланс:(?:[^>]*>){2}([^<]+)/i, replaceTagsAndSpaces, parseBalance);
	getParam(html, result, 'deadline', /Хватит до:(?:[^>]*>){2}([^<]+)/i, replaceTagsAndSpaces, parseDate);
	getParam(html, result, '__tariff', /Тарифный план:(?:[^>]*>){2}([^<]+)/i, replaceTagsAndSpaces, html_entity_decode);
	getParam(html, result, 'abon', /Ежемесячная абон\. плата:(?:[^>]*>){2}([^<]+)/i, replaceTagsAndSpaces, parseBalance);
	
	AnyBalance.setResult(result);
}