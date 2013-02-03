/**
Провайдер AnyBalance (http://any-balance-providers.googlecode.com)

Телеинфо ВТБ24
Сайт оператора: https://telebank.vtb24.ru/
Личный кабинет: https://telebank.vtb24.ru/WebNew/
*/

function main(){
	var prefs = AnyBalance.getPreferences();
	var baseurl = 'https://telebank.vtb24.ru/WebNew/';
	
	var html = AnyBalance.requestGet(baseurl+'Login.aspx');

	var $html = $(html);
	var form_data = {
		__EVENTVALIDATION: $html.find('#__EVENTVALIDATION').val(),
		__VIEWSTATE: $html.find('#__VIEWSTATE').val(),
		js: 1,
		m: 1,
		__LASTFOCUS: '',
		__EVENTTARGET: '',
		__EVENTARGUMENT: '',
		Action: '',
		ButtonLogin: '',
		TextBoxName: prefs.login,
		TextBoxPassword: prefs.password
	}
	
    var html = AnyBalance.requestPost(baseurl+'Login.aspx', form_data);
    var $html = $(html);

    if(!/location.href\s*=\s*"[^"]*Accounts.aspx/i.test(html)){
        var val = $html.find('#LabelError').text();
        if (val){
        	throw new AnyBalance.Error($html.find('#LabelMessage').text());
        }
       if(/id="ItemNewPassword"/i.test(html))
           throw new AnyBalance.Error('Телеинфо требует поменять пароль. Пожалуйста, войдите в Телеинфо через браузер, поменяйте пароль, а затем введите новый пароль в настройки провайдера.');
        
       throw new AnyBalance.Error('Не удалось зайти в Телеинфо. Сайт изменен?');
    }

    if(prefs.type == 'abs'){
        fetchAccountABS(baseurl);
    }else{ //card
        fetchCard(baseurl);
    }
}

function fetchAccountABS(baseurl){
    var prefs = AnyBalance.getPreferences();
    var html = AnyBalance.requestGet(baseurl+'Accounts/Accounts.aspx?_ra=4');

    if(prefs.card && !/^\d{4,20}$/.test(prefs.card))
        throw new AnyBalance.Error('Пожалуйста, введите не менее 4 последних цифр номера счета, по которому вы хотите получить информацию, или не вводите ничего, чтобы получить информацию по первому счету.');

    var table = getParam(html, null, null, /<table[^>]+class="[^"]*accounts[^>]*>([\s\S]*?)<\/table>/i);
    if(!table)
        throw new AnyBalance.Error('Не найдена таблица счетов. Сайт изменен?');

    //Сколько цифр осталось, чтобы дополнить до 20
    var accnum = prefs.card || '';
    var accprefix = accnum.length;
    accprefix = 20 - accprefix;

    var result = {success: true};

    var re = new RegExp('(<tr[^>]*(?:[\\s\\S](?!</tr))*' + (accprefix > 0 ? '\\d{' + accprefix + '}' : '') + accnum + '\\s*<[\\s\\S]*?</tr>)', 'i');

    var tr = getParam(html, null, null, re);
    if(!tr)
        throw new AnyBalance.Error('Не удаётся найти ' + (prefs.card ? 'счет с ID ' + prefs.card : 'ни одного счета'));
    
    getParam(tr, result, 'balance', /(?:[\s\S]*?<td[^>]*>){4}([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, parseBalance);
    getParam(tr, result, 'cardnum', /(?:[\s\S]*?<td[^>]*>){3}([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, html_entity_decode);
    getParam(tr, result, '__tariff', /(?:[\s\S]*?<td[^>]*>){2}([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, html_entity_decode);
    getParam(tr, result, ['currency', 'balance'], /(?:[\s\S]*?<td[^>]*>){5}([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, html_entity_decode);
    getParam(tr, result, 'cardname', /(?:[\s\S]*?<td[^>]*>){3}([\s\S]*?)<\/td>/i, replaceTagsAndSpaces, html_entity_decode);
    getParam(html, result, 'fio', /<div[^>]+id="name"[^>]*>([\s\S]*?)<\/div>/i, replaceTagsAndSpaces, html_entity_decode);

    AnyBalance.setResult(result);
    

}

function fetchCard(baseurl){
    var prefs = AnyBalance.getPreferences();
    var html = AnyBalance.requestGet(baseurl+'Accounts/Accounts.aspx');

    var $html = $(html);

    var result = {success: true};

    var $accounts = $html.find('table.accounts');

    var $card_tr;

    if (prefs.card){                        
	$card_tr = $accounts.find('tr:contains("XXXXXX'+prefs.card+'")');
    }else{
	$card_tr = $accounts.find('tr:contains("XXXXXX")');
    }

    AnyBalance.trace('Найдено карт: ' + $card_tr.size());
    if(!$card_tr.size())
        throw new AnyBalance.Error(prefs.card ? 'Не найдена карта с последними цифрами ' + prefs.card : 'Не найдено ни одной карты');

    var result = {success: true};
    $card_tr = $card_tr.first();
    result.__tariff = $card_tr.find('td.number').text();
    if(AnyBalance.isAvailable('cardnum'))
        result.cardnum = result.__tariff;

    if(AnyBalance.isAvailable('cardname')){
        result.cardname = $card_tr.find('td:nth-child(2)').text().replace(/&nbsp;/g, ' ').replace(/^\s+|\s+$/g, '');
    }

    if(AnyBalance.isAvailable('currency', 'balance')){
        result.cardname = $card_tr.find('td:nth-child(5)').text().replace(/&nbsp;/g, ' ').replace(/^\s+|\s+$/g, '');
    }

    if(AnyBalance.isAvailable('balance')){
    	val = $card_tr.find('td:nth-child(4)').text();
    	if (val)
    		val = val.replace(/[^0-9.,]+/,'');
        if(val)
            result.balance = parseFloat(val.replace(',','.'));
    }
    
    getParam(html, result, 'fio', /<div[^>]+id="name"[^>]*>([\s\S]*?)<\/div>/i, replaceTagsAndSpaces, html_entity_decode);

    AnyBalance.setResult(result);
}