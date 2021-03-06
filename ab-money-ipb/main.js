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
	var baseurl = 'https://online.ipb.ru/';
	AnyBalance.setDefaultCharset('windows-1251');
	
	checkEmpty(prefs.login, 'Введите логин!');
	checkEmpty(prefs.password, 'Введите пароль!');
	
	var html = AnyBalance.requestGet(baseurl, g_headers);
	
	var params = createFormParams(html, function(params, str, name, value) {
		if (name == 'namev') 
			return prefs.login;
		else if (name == 'passv')
			return prefs.password;

		return value;
	});
	
	html = AnyBalance.requestPost(baseurl + 'ent/', params, addHeaders({Referer: baseurl + 'ent/'}));
	
	if (!/\/exit/i.test(html)) {
		var error = getParam(html, null, null, /<div[^>]+class="t-error"[^>]*>[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/i, replaceTagsAndSpaces, html_entity_decode);
		if (error)
			throw new AnyBalance.Error(error, null, /Неверный логин или пароль/i.test(error));
		
		throw new AnyBalance.Error('Не удалось зайти в личный кабинет. Сайт изменен?');
	}
	
	var result = {success: true};
	
	getParam(html, result, 'balance', /Доступно[^>]*>([^<]+)/i, replaceTagsAndSpaces, parseBalance);
	getParam(html, result, ['currency', 'balance'], /Доступно[^>]*>([^<]+)/i, [replaceTagsAndSpaces, /\./i, ''], parseCurrency);
	getParam(html, result, '__tariff', /№ Карты(?:[^>]*>){15}([^<]+)/i, replaceTagsAndSpaces, html_entity_decode);
	getParam(html, result, 'cardnum', /№ Карты(?:[^>]*>){15}([^<]+)/i, replaceTagsAndSpaces, html_entity_decode);
	getParam(html, result, 'deadline', /№ Карты(?:[^>]*>){19}([^<]+)/i, replaceTagsAndSpaces, parseDate);
	getParam(html, result, 'accnum', /Картсчет(?:[^>]*>){1}([^<]+)/i, replaceTagsAndSpaces, html_entity_decode);
	
	AnyBalance.setResult(result);
}