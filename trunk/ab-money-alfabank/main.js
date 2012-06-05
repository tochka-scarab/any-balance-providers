﻿/**
Провайдер AnyBalance (http://any-balance-providers.googlecode.com)

Получает текущий остаток и другие параметры карт Альфабанка, используя мобильный Альфа-клик.

Сайт оператора: http://alfabank.ru/
Личный кабинет: https://m.alfabank.ru/
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
    text = text.replace(/\s+/, '');
    var val = getParam(text, null, null, /(-?\d[\d\.,]*)/, replaceFloat, parseFloat);
    AnyBalance.trace('Parsing balance (' + val + ') from: ' + text);
    return val;
}

function parseCurrency(text){
    text = text.replace(/\s+/, '');
    var val = getParam(text, null, null, /-?\d[\d\.,]*&nbsp;(\S*)/);
    AnyBalance.trace('Parsing currency (' + val + ') from: ' + text);
    return val;
}

function parseDate(str){
    AnyBalance.trace('Parsing date from value: ' + str);
    var matches = /(\d+)[^\d](\d+)[^\d](\d+)/.exec(str);
    var time;
    if(matches){
	  time = (new Date(+matches[3], matches[2]-1, +matches[1])).getTime();
    }
    return time;
}

function main(){
    var prefs = AnyBalance.getPreferences();

    var baseurl = "https://m.alfabank.ru/ALFAPDA/ControllerServlet";
    AnyBalance.setDefaultCharset('utf-8');

    if(prefs.cardnum && !/\d{4}/.test(prefs.cardnum))
        throw new AnyBalance.Error("Введите 4 последних цифры номера карты или не вводите ничего, чтобы показать информацию по первой карте");

    var html = AnyBalance.requestGet(baseurl);
    var OTOkey = getParam(html, null, null, /['"]OTOkey['"]\s*value=["']([^'"]*)["']/i);
    var loginname = getParam(html, null, null, /['"]field_login['"]\s*name=["']([^'"]*)["']/i);
    var passname = getParam(html, null, null, /['"]field_passwd['"]\s*name=["']([^'"]*)["']/i);

    var params = {
        command:'auth_loginByPassword',
        OTOKey:OTOkey
    };

    params[loginname] = prefs.login;
    params[passname] = prefs.password;

    html = AnyBalance.requestPost(baseurl, params);

    var error = getParam(html, null, null, /в связи с ошибкой в работе системы[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>/i, replaceTagsAndSpaces, html_entity_decode);
    if(error)
        throw new AnyBalance.Error(error);

    html = AnyBalance.requestPost(baseurl, {command:'card_list'});
    var cardnum = prefs.cardnum || '\\d{4}';

    var cardidx = getParam(html, null, null, new RegExp("'card_detail',\\s*'([^']*)'[^>]*>\\d\"?\\*" + cardnum, 'i'));
    if(!cardidx){
        if(prefs.cardnum)
            throw new AnyBalance.Error('Не удалось найти карту с последними цифрами ' + prefs.cardnum);
        else
            throw new AnyBalance.Error('Не удалось найти ни одной карты!');
    }
    
    html = AnyBalance.requestPost(baseurl, {command:'card_detail', custom1: cardidx});

    var result = {success: true};
    
    getParam(html, result, 'cardnum', /Номер карты:[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i);
    getParam(html, result, 'userName', /ФИО держателя карты:[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, html_entity_decode);
    getParam(html, result, 'till', /Срок действия карты:[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, html_entity_decode);
    getParam(html, result, 'accnum', /Номер счета:[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, html_entity_decode);
    getParam(html, result, 'balance', /Баланс счета:[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, parseBalance);
    getParam(html, result, 'currency', /Баланс счета:[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, parseCurrency);
   
    var type = getParam(html, null, null, /Тип карты:[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, html_entity_decode);
    if(type && /кредитная/i.test(type) && AnyBalance.isAvailable('topay','paytill','minpay','penalty','late','overdraft','limit','debt','gracetill')){
        var accnum = getParam(html, null, null, /Номер счета:[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, html_entity_decode);
        if(!accnum)
            throw new AnyBalance.Error('Не удалось найти номер счета карты!');
   
    	html = AnyBalance.requestPost(baseurl, {command:'balances_listMyLoans'});

        var loanidx = getParam(html, null, null, new RegExp("'creditDetail_accountDetail',\\s*'([^']*)'[^<]*" + accnum, 'i'));
        if(!loanidx)
            throw new AnyBalance.Error('Невозможно найти кредитную информацию по карте!');

        html = AnyBalance.requestPost(baseurl, {command:'creditDetail_accountDetail', custom1: loanidx});
        
        getParam(html, result, 'topay', /Сумма к оплате:[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, parseBalance);
        getParam(html, result, 'paytill', /Оплатить до:[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, parseDate);
        getParam(html, result, 'minpay', /Минимальный платеж:[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, parseBalance);
        getParam(html, result, 'penalty', /Штрафы:[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, parseBalance);
        getParam(html, result, 'late', /Просроченная задолженность:[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, parseBalance);
        getParam(html, result, 'overdraft', /Несанкционированный перерасход:[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, parseBalance);
        getParam(html, result, 'limit', /Установленный кредитный лимит:[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, parseBalance);
        getParam(html, result, 'debt', /Общая задолженность:[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, parseBalance);
        getParam(html, result, 'gracetill', /Дата окончания льготного периода:[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, parseDate);
    }

    AnyBalance.setResult(result);
}

function html_entity_decode(str)
{
    //jd-tech.net
    var tarea=document.createElement('textarea');
    tarea.innerHTML = str;
    return tarea.value;
}

