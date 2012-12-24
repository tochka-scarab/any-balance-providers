﻿/**
Провайдер AnyBalance (http://any-balance-providers.googlecode.com)

Текущий баланс у московского интернет-провайдера Complat

Сайт оператора: http://www.complat.ru
Личный кабинет: https://stat.complat.ru/login.dhtml
*/

function parseTrafficMb(str){
  var val = getParam(str.replace(/\s+/g, ''), null, null, /(-?\d[\d\s.,]*)/, replaceFloat, parseBalance);
  return val;
}

function main(){
    var prefs = AnyBalance.getPreferences();

    AnyBalance.setDefaultCharset('windows-1251');

    var baseurl = "https://stat.complat.ru/";

    var html = AnyBalance.requestPost(baseurl + 'login.dhtml', {
        login:prefs.login,
        zone:'flow',
        pw:prefs.password
    });

    //AnyBalance.trace(html);

    if(!/logout.dhtml/i.test(html)){
        var error = getParam(html, null, null, /Информационное сообщение[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, html_entity_decode);
        if(error)
            throw new AnyBalance.Error(error);
        
        throw new AnyBalance.Error("Не удалось войти в личный кабинет. Личный кабинет изменился или проблемы на сайте.");
    }

    var result = {success: true};

    getParam(html, result, 'balance', /Баланс счета[\s\S]*?<td[^>]*>([\S\s]*?)<\/td>/i, replaceTagsAndSpaces, parseBalance);
    getParam(html, result, 'payday', /День расчетов[\s\S]*?<td[^>]*>([\S\s]*?)<\/td>/i, replaceTagsAndSpaces, parseBalance);
    getParam(html, result, '__tariff', /Тариф[\s\S]*?<td[^>]*>([\S\s]*?)<\/td>/i, replaceTagsAndSpaces, html_entity_decode);
    getParam(html, result, 'status', /Статус пользователя[\s\S]*?<td[^>]*>([\S\s]*?)(?:<a|<\/td>)/i, replaceTagsAndSpaces, html_entity_decode);

    if(AnyBalance.isAvailable('trafficIn','trafficOut')){
        html = AnyBalance.requestGet(baseurl + "datetraffic.dhtml");
        getParam(html, result, 'trafficIn', /Входящего(?:[\s\S]*?<td[^>]*>){2}([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, parseTrafficMb);
        getParam(html, result, 'trafficOut', /Исходящего(?:[\s\S]*?<td[^>]*>){2}([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, parseTrafficMb);
    }

    AnyBalance.setResult(result);
}
