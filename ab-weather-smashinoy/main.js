function main(){        AnyBalance.trace('Connecting...');               var result = {success: true};        var prefs = AnyBalance.getPreferences();        var city = prefs.city; // �����               var info = AnyBalance.requestPost('http://ab1.smashinoy.ru/get_xml/', {                city: city,        });               var xmlDoc = $.parseXML(info.replace('windows-1251', 'utf-8')),          $xml = $(xmlDoc);               AnyBalance.trace('Checking error...');               //��������, ��� �� ������        var $error = $xml.find('smashinoy>error').each(function(){                throw new AnyBalance.Error($(this).text());        });               AnyBalance.trace('Looking for data...');               var $data = $xml.find('smashinoy');        if(!$data.size())                throw new AnyBalance.Error("Not found data!");               AnyBalance.trace('Getting counters...');               if(AnyBalance.isAvailable('score')){                result.score = parseInt($data.find('score').text());         }                       if(AnyBalance.isAvailable('txt')){                result.txt = $data.find('txt').text();        }		AnyBalance.trace('City is '+$data.find('city').text());		result.__tariff = $data.find('city').text();               AnyBalance.setResult(result);}