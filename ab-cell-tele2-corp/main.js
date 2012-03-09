﻿/**
Провайдер AnyBalance (http://any-balance-providers.googlecode.com)

Текущий баланс у сотового оператора Tele2 (Россия).

Сайт оператора: http://www.tele2.ru/
Личный кабинет: https://my.tele2.ru/
*/

function getParam (html, result, param, regexp, replaces, parser) {
	if (param && !AnyBalance.isAvailable (param))
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

function main(){
    var prefs = AnyBalance.getPreferences();

    var baseurl = "https://webcare.tele2.ru/";


    AnyBalance.setDefaultCharset('utf-8');
//    var html = AnyBalance.requestGet(baseurl + "c/portal/login?k=2");

    var html = AnyBalance.requestPost(baseurl + "c/portal/login?cmd=login&redirect=https://webcare.tele2.ru/c&fail_redirect=https://webcare.tele2.ru/group/public/login?p_p_id=AACALoginPortlet_WAR_PT_SML_AA_CALoginPortlet_v11portlet&p_p_lifecycle=0&p_p_state=normal&p_p_mode=view&p_p_col_id=column-1&p_p_col_count=1", {
        j_username: prefs.login,
        j_password: prefs.password,
        auth_type: 1
    });

    if(html.indexOf('/group/public/login') >= 0){
      //Не удалось войти
      throw new AnyBalance.Error('Не удалось войти. Неправильный логин-пароль или проблемы на сайте.');
    }

    html = AnyBalance.requestGet(baseurl + "c");
    
    var result = {success: true}; //Баланс нельзя не получить, не выдав ошибку!
    
    getParam(html, result, 'balance', /Всего доступно средств:[\s\S]*?>(-?\d[\d,\.\s]*)</i, [/\s+/g, '', /,/g, '.'], parseFloat);
    getParam(html, result, 'balance_personal', /Персональные балансы:[\s\S]*?Итого доступно:[\s\S]*?>(-?\d[\d,\.\s]*)</i, [/\s+/g, '', /,/g, '.'], parseFloat);
    getParam(html, result, 'balance_corp', /Корпоративные балансы:[\s\S]*?Итого доступно:[\s\S]*?>(-?\d[\d,\.\s]*)</i, [/\s+/g, '', /,/g, '.'], parseFloat);

    var eventid = getParam(html, null, null, /<a[^>]*?id="([^"]*)"[^>]*?><div><table cellpadding="0" cellspacing="0"><tr><td>Персональные данные/i);
    var params = {
        'ice.submit.partial': true,
        'ice.event.target': '',
        'ice.event.captured': eventid,
        'ice.event.type':'onclick',
        'ice.event.alt':false,
        'ice.event.ctrl':false,
        'ice.event.shift':false,
        'ice.event.meta':false,
        'ice.event.x':549,
        'ice.event.y':341,
        'ice.event.left':false,
        'ice.event.right':false,
        '_WCPersonalAccount_WAR_PT_CC_WCPortlet_v1portlet_:personalAccountForm:_idcl': eventid.replace(/\.\d+$/, ''),
        '':'',
        '_WCPersonalAccount_WAR_PT_CC_WCPortlet_v1portlet_:personalAccountForm:_id_WCPersonalAccount_WAR_PT_CC_WCPortlet_v1portlet_:personalAccountForm:j_id88dropID':'',
        '_WCPersonalAccount_WAR_PT_CC_WCPortlet_v1portlet_:personalAccountForm:_id_WCPersonalAccount_WAR_PT_CC_WCPortlet_v1portlet_:personalAccountForm:j_id88status':'',
        '_WCPersonalAccount_WAR_PT_CC_WCPortlet_v1portlet_:personalAccountForm:balance_selectionHolder':'',
        '_WCPersonalAccount_WAR_PT_CC_WCPortlet_v1portlet_:personalAccountForm:j_id19:0:corporate_balances_selectionHolder':'',
        '_WCPersonalAccount_WAR_PT_CC_WCPortlet_v1portlet_:personalAccountForm:j_id19:0:personal_balances_selectionHolder':'',
        '_WCPersonalAccount_WAR_PT_CC_WCPortlet_v1portlet_:personalAccountForm:personalAccountFormTmp':'tmp',
        'javax.faces.RenderKitId':'ICEfacesRenderKit',
        'javax.faces.ViewState':1,
        'icefacesCssUpdates':'',
        '_WCPersonalAccount_WAR_PT_CC_WCPortlet_v1portlet_:personalAccountForm':'_WCPersonalAccount_WAR_PT_CC_WCPortlet_v1portlet_:personalAccountForm'
    };
    params[eventid] = eventid;
    params['ice.session']= getParam(html, null, null, /session:\s*['"]([^'"]*)['"]/);
    params['ice.view']=1;
    params['ice.focus']='undefined';
    params['rand']=0.8372334879823029;
    
    var html = AnyBalance.requestPost(baseurl + "PT_CC_WCPortlet_v1-portlet/block/send-receive-updates", params, {Origin: baseurl, Referer: baseurl + 'group/public/account_info'});
    result.__tariff = getParam(html, null, null, /Тарифный план[\s\S]*?<span[^>]*>(.*?)<\/span>/i);
    getParam(html, result, 'company', /Наименование[\s\S]*?<span[^>]*>(.*?)<\/span>/i);
    getParam(html, result, 'userName', /Абонент\s*<[\s\S]*?<span[^>]*>(.*?)<\/span>/i);
    getParam(html, result, 'status', /Статус абонента[\s\S]*?<span[^>]*>(.*?)<\/span>/i);
    
    AnyBalance.setResult(result);
}
