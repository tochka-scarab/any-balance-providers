/**
Провайдер AnyBalance (http://any-balance-providers.googlecode.com)

Отображает баланс по выбранным валютам на OnPay.ru.
Провайдер получает эти данные из кабинета. Для работы требуется указать в настройках логин и пароль.

Сайт партнерки: http://onpay.ru/
*/

function main() {
	
	var result={
        success: true
    };

    var prefs=AnyBalance.getPreferences();
    
    var html=AnyBalance.requestGet('https://secure.onpay.ru/login');
    var r=new RegExp('<input name="authenticity_token" type="hidden" value="(.+?)" />');
    var matches=r.exec(html);
	if(matches==null) throw new AnyBalance.Error('Ошибка разбора страницы');
    
	var html=AnyBalance.requestPost('https://secure.onpay.ru/authentication/create',{
		'utf8':'✓',
		'authenticity_token':matches[1],
		'user[login]':prefs.login,
		'user[password]':prefs.password,
		'commit':'Войти'
	});
	
	if(html.indexOf('<a href="/logout"')==-1) throw new AnyBalance.Error('Ошибка авторизации. Проверьте логин и пароль');
	
	html=AnyBalance.requestGet('https://secure.onpay.ru/accounts');	
	r=new RegExp("<tr id='row-([A-Z]{3})[\\s\\S]+? id='delayed.+?'>([0-9.]+)</td>\\s+[\\s\\S]+? id='balance.+?'>([0-9.]+)(?: / [0-9.]+)?</td>",'g');
	var found=false;
	while((matches=r.exec(html))!=null) {
		if(!found) found=true;
		if(AnyBalance.isAvailable(matches[1]+'_delayed')) result[matches[1]+'_delayed']=matches[2];
		if(AnyBalance.isAvailable(matches[1]+'_balance')) result[matches[1]+'_balance']=matches[3];
	}
	
	if(!found) throw new AnyBalance.Error('Ошибка разбора данных');

    AnyBalance.setResult(result);
}
