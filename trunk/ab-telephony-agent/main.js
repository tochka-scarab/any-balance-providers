﻿/**
Провайдер AnyBalance (http://any-balance-providers.googlecode.com)

Получает текущий остаток и другие параметры у мейлрушного агента

Сайт оператора: http://agent.mail.ru/
Личный кабинет: http://agent.mail.ru/
*/

function main(){
    var prefs = AnyBalance.getPreferences();
    if(!prefs.login)
         throw new AnyBalance.Error('Введите е-мейл для входа в личный кабинет agent.mail.ru');

    var parts = prefs.login.match(/^(\w+)@((?:mail|inbox|list|bk)\.ru)$/i);
    if(!parts)
         throw new AnyBalance.Error('Вы ввели неправильный е-мейл для входа на agent.mail.ru.');

    var baseurlLogin = "https://auth.mail.ru/cgi-bin/auth";
    var baseurl = "http://agent.mail.ru/";

    AnyBalance.setDefaultCharset('utf-8');

    var html = AnyBalance.requestPost(baseurlLogin, {
        page:baseurl,
        post:'',
        login_from:'',
        lang:'',
        setLang:'',
        Login:parts[1],
        Domain:parts[2].toLowerCase(),
        Password:prefs.password,
        new_auth_form:1
    });

    if(!/url=http:\/\/agent.mail.ru/i.test(html))
        throw new AnyBalance.Error('Не удалось войти в личный кабинет. Неправильный логин-пароль?');

    html = AnyBalance.requestGet(baseurl); 

    if(!/\/cgi-bin\/logout/i.test(html)){
        throw new AnyBalance.Error('Не удалось войти в личный кабинет. Неправильный логин-пароль?');
    }

    html = AnyBalance.requestGet(baseurl + 'phonecalls/cabinet/settings');

    var result = {success: true};
    getParam(html, result, 'license', /<label[^>]*>Номер счета[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>/i, replaceTagsAndSpaces, html_entity_decode);
    getParam(prefs.login, result, 'login');
    getParam(prefs.login, result, '__tariff');
    getParam(html, result, 'balance', /<label[^>]*>Текущий баланс[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>/i, replaceTagsAndSpaces, parseBalance);
    getParam(html, result, 'number', /<label[^>]*>Номер при вызове[\s\S]*?<option[^>]+value="([^"]*)[^>]*selected/i, replaceTagsAndSpaces, html_entity_decode);

    AnyBalance.setResult(result);
}
