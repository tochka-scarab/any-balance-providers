/**
Провайдер AnyBalance (http://any-balance-providers.googlecode.com)
*/

var g_headers = {
	Accept: '*/*',
	'Accept-Language': 'ru,en;q=0.8',
	Connection: 'keep-alive',
	'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.71 Safari/537.36'
};

var g_baseurl = 'https://moyaposylka.ru';

function apiCall(params) {
	html = AnyBalance.requestPost(g_baseurl + '/apps/tracker/v2', JSON.stringify(params), addHeaders({
		Accept: 'application/json, text/plain, */*',
		'Content-Type': 'application/json;charset=UTF-8',
		Origin: g_baseurl,
		Referer: g_baseurl + '/',
		'X-Apps-Request': 'MoyaPosylka'
	}));
	
	var json = getJson(html);
	
	if(!json.success)
		throw new AnyBalance.Error(json.error.code || JSON.stringify(json.error));
	
	return json;
}

function getMyPosylkaResult(prefs) {
	AnyBalance.trace('Connecting to moyaposylka...');
	checkEmpty(prefs.track_id, 'Введите код почтового отправления!');
	
	var dest = prefs.track_dest || "RU"; //Страна назначения
	var html = AnyBalance.requestGet(g_baseurl, g_headers);
	
	AnyBalance.setCookie('moyaposylka.ru', 'trackerNumber', prefs.track_id);
	AnyBalance.setCookie('moyaposylka.ru', 'countryCode', dest);
	
	var json = apiCall({
		"method":"createRequest",
		"params":{
			"type":"ru",
			"number":prefs.track_id,
			"countryCode":dest
		}
	});
	// Нужно дать данным обновится, иначе получим 404
	sleep(3000);
	
	json = apiCall({
		"method":"getRequestInfo",
		"params":{
			"token":json.result
		}
	});
	
	var result = {success: true};
	
	var tracker = json.result;
	var ls = tracker.statuses[0];
	
	var lsdate = (ls && ls.date) || '',
		lsplace = (ls && ls.place) || '',
		lsstatus = (ls && ls.operation.name) || '???';
	
	getParam(tracker.number, result, 'trackid');
	getParam(tracker.trackTime + '', result, 'days', null, null, parseBalance);
	getParam(tracker.weight + '', result, 'weight', null, null, parseBalance);
	getParam(lsdate, result, 'date', null, null, parseDateISO);
	getParam(lsplace, result, 'address');
	getParam(lsstatus, result, 'status');
	
	if (AnyBalance.isAvailable('fulltext')) {
		var date = getParam(lsdate, null, null, null, null, parseDateISO) || (new Date().getTime());
		var address = lsplace;
		var status = lsstatus;
		var days = tracker.trackTime;
		result.fulltext = '<b>' + status + '</b><br/>\n' + '<small>' + getDateString(date) + '</small>: ' + address + '<br/>\n' + 'в пути ' + days + ' дн.';
	}
	return result;
}

function main() {
	var prefs = AnyBalance.getPreferences();
	var result = getMyPosylkaResult(prefs);
	AnyBalance.setResult(result);
}

function numSize(num, size) {
	var str = num + '';
	if (str.length < size) {
		for (var i = str.length; i < size; ++i) {
			str = '0' + str;
		}
	}
	return str;
}

function getDateString(dt) {
	if (typeof dt != 'object') dt = new Date(dt);
	return numSize(dt.getDate(), 2) + '/' + numSize(dt.getMonth() + 1, 2) + '/' + dt.getFullYear() + " " + numSize(dt.getHours(), 2) + ':' + numSize(dt.getMinutes(), 2);
}

function sleep(delay) {
	AnyBalance.trace('Sleeping ' + delay + ' ms');
	if (AnyBalance.getLevel() < 6) {
		var startTime = new Date();
		var endTime = null;
		do {
			endTime = new Date();
		} while (endTime.getTime() - startTime.getTime() < delay);
	} else {
		AnyBalance.trace('Calling hw sleep');
		AnyBalance.sleep(delay);
	}
}

function createCountries(baseurl, result) {
	var html = AnyBalance.requestGet(baseurl);
	var ids = [],
	names = [];
	html.replace(/<option[^>]+value="([^"]*)[^>]*>([^<]*)<\/option>/ig, function(str, countryid, countryname) {
		ids[ids.length] = countryid;
		names[names.length] = countryname;
		return str;
	});
	result.entries = ids.join('|');
	result.entryValues = names.join('|');
}