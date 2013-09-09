﻿/**
Провайдер AnyBalance (http://any-balance-providers.googlecode.com)
*/

var g_headers = {
	'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
	'Accept-Charset':'windows-1251,utf-8;q=0.7,*;q=0.3',
	'Accept-Language':'ru-RU,ru;q=0.8,en-US;q=0.6,en;q=0.4',
	'Connection':'keep-alive',
	'Origin':'https://user.infolink.ru',
	'User-Agent':'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/29.0.1547.66 Safari/537.36'
};

function main(){
    var prefs = AnyBalance.getPreferences();
    var baseurl = 'https://user.infolink.ru/';
    AnyBalance.setDefaultCharset('utf-8'); 
	
	var loginParams = {
        login:prefs.login,
        password:prefs.password,
        submit:''
    };
	var html = AnyBalance.requestPost(baseurl, loginParams, addHeaders({Referer: baseurl+ 'index.php'})); 
	// Нужно почему-то дважды
	html = AnyBalance.requestPost(baseurl, loginParams, addHeaders({Referer: baseurl+ 'index.php'})); 
	
    if(!/\/Logout/i.test(html)){
        var error = getParam(html, null, null, /<div[^>]*>([\s\S]*?)<\/div>/i, replaceTagsAndSpaces, html_entity_decode);
        if(error)
            throw new AnyBalance.Error(error);
        throw new AnyBalance.Error('Не удалось зайти в личный кабинет. Сайт изменен?');
    }
    var result = {success: true};
	
	getParam(html, result, '__tariff', /(Интернет[^>]*>[^>]*href="\/services\/list[^>]*>[^>]*>[^>]*>)/i, replaceTagsAndSpaces, html_entity_decode);
	getParam(html, result, 'acc_num', /Номер лицевого счёта:([\s\S]*?)<\/button/i, replaceTagsAndSpaces, html_entity_decode);
    getParam(html, result, 'balance', /Баланс([^>]*>){5}/i, replaceTagsAndSpaces, parseBalance);
	getParam(html, result, 'bonuses', /Бонусы([^>]*>){5}/i, replaceTagsAndSpaces, parseBalance);
	// Посчитаем дату отключения, чтобы можно было назначить нотиф на нее
	if(isAvailable('deadline')){
		var days = getParam(html, null, null, /До отключения:\s*(\d+)\s*дн/i, null, parseBalance);
		var date = new Date().getTime();
		//      day in ms
		date += 86400000 * days;
		result.deadline = date;
	}
	if(isAvailable('incoming_traf')){
		html = AnyBalance.requestGet(baseurl+'detailing/internet', addHeaders({Referer: baseurl+ 'index.php'}));
		getParam(html, result, 'incoming_traf', /Всего:([^<]*)/i, replaceTagsAndSpaces, parseTraffic);
	}
    AnyBalance.setResult(result);
}