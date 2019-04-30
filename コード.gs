var LINE_MEMO_ACCESS_TOKEN = "<このスクリプトと連携したLINE公式アカウントのトークン>";
var USER_ID = "<myLINEアカウントのトークン>";

function doPost(e) {
  var accountAttribute = (e.parameter.text == undefined) ? "LINE" : "Slack";
  
  if (accountAttribute == "LINE"){
    var webhookData = JSON.parse(e.postData.contents).events[0];
    var token = webhookData.replyToken;
    var message = webhookData.message.text;
  }else {
    if (e.parameter.user_name != "slackbot"){
      var token = e.parameter.token;
      var message = e.parameter.text;
    }
  }
  return (message == undefined) ? false : sendResponse(accountAttribute,token,message);
}

function sendResponse(accountAttribute,token,message){
 var spreadSheetId = fetchTheSpreadSheet();
 var spreadSheet = SpreadsheetApp.openById(spreadSheetId);
 var sheets = spreadSheet.getSheets();
 var splitedMessage = message.split(" ");
  
 switch (accountAttribute) {
   case "LINE":  var sheet;
                 var statusForSelectingSheet = /^入金|出金$/;
                 (statusForSelectingSheet.test(splitedMessage[0])) ? sheet = sheets[2] : sheet = sheets[0];
                 var parsedResult = parseMessage(sheet, splitedMessage);
                 var url = "https://api.line.me/v2/bot/message/reply";
                 var postData = {
                   "replyToken" : token,
                   "messages" : [{ "type" : "text", "text" : parsedResult}]
                 };
                 var headers = {
                   "Content-Type" : "application/json; charset=UTF-8",
                   "Authorization" : "Bearer " + LINE_MEMO_ACCESS_TOKEN
                 };
                 break; 
   case "Slack": var parsedResult = parseMessage(sheets[1], splitedMessage); 
                 var url = "https://hooks.slack.com/services/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";
                 var postData = {
                   "text" : parsedResult
                 };
                 var headers = {
                   "Content-Type" : "application/json; charset=UTF-8"
                 };
                 break;         
 }
 var options = {
                  "method":"POST",
                  "headers": headers,
                  "payload": JSON.stringify(postData)
                };
 return UrlFetchApp.fetch(url, options);  
}

//データベース代わりに活用しているスプレッドシートの情報を取ってくるメソッド
function fetchTheSpreadSheet() {
  var userProperties = PropertiesService.getUserProperties();
  var spreadSheetId = userProperties.getProperty('SPREAD_SHEET_ID');
  
  if(!spreadSheetId) {
    var newSpreadSheet = SpreadsheetApp.create('管理スプレッドシート');
    var sheetsToBeMade = ["MEMOForPrivate","MEMOForWork","家計簿"];
    sheetsToBeMade.forEach(function(value,index){
      newSpreadSheet.insertSheet(value,index);
    });
    userProperties.setProperty('SPREAD_SHEET_ID', newSpreadSheet.getId());
    spreadSheetId = userProperties.getProperty('SPREAD_SHEET_ID');
  }
  return spreadSheetId;
}

function parseMessage(sheet, splitedMessage) {
　　　　var statusForSearchingData =/^検索|all|1ヶ月|一ヶ月|半年|登録一覧|次回一覧|宿題一覧$/;
  var statusForDepositsAndWithdrawals = /^入金|出金$/;
  if (statusForSearchingData.test(splitedMessage[0])) {
    return searchDataInTheSpreadSheet(splitedMessage[0], sheet, splitedMessage[1]);
  }else if(statusForDepositsAndWithdrawals.test(splitedMessage[0])) {
    return insertDataInTheHouseholdAccountBook(splitedMessage[0], sheet, splitedMessage[1]);
  }  
  return insertDataInTheSpreadSheet(splitedMessage[0], sheet, splitedMessage[1]); 
}

//MEMOForPrivateテーブルかMEMOForWorkテーブル内にデータを挿入するメソッド
function insertDataInTheSpreadSheet(status, sheet, message) {
  switch (status) {
    case "次回":
    case "宿題": 
    case "登録": sheet.appendRow([message, new Date(), status]);
                break;
    default: sheet.appendRow([status,new Date()]);
  }
  return "処理を受付けました。";
}

//家計簿テーブル内にデータを挿入するメソッド
function insertDataInTheHouseholdAccountBook(status, sheet, message) {
  var today = new Date();
  var gottenDate = today.getDate();
  
  (status == "残高") ? today.setDate(gottenDate+10) : today;
  sheet.appendRow([message, today, status]);
  return "処理を受付けました。";
}

//MEMOForPrivateテーブルとMEMOForWorkテーブル内のデータを検索するメソッド
function searchDataInTheSpreadSheet(status, sheet, message) {
  var colValues1 = sheet.getRange(1,1,sheet.getLastRow(),1).getValues();
  var colValues1Searched = [];
  var allValuesOnSheet = sheet.getRange(1,1,sheet.getLastRow(),3).getValues();
  var setDate = new Date();
  var thisYear = setDate.getFullYear();
  var thisMonth = (setDate.getMonth() + 1);
  
  function fetchDataOfColValues1WhereColValues2Exist() {
      allValuesOnSheet.forEach(function(value) {
        if (value[1].getTime() >= setDate.getTime()){
          colValues1Searched.push(value[0]);
        }
     });
  return colValues1Searched.length > 0 ? colValues1Searched.join("\n") : "一致するものは見つかりませんでした。";
  }
  
  switch (status) { 
    case "検索": allValuesOnSheet.forEach(function(value) {
                  if (value[0].indexOf(message) >= 0){
                    colValues1Searched.push(value[0]);
                  }
                });
                return colValues1Searched.length > 0 ? colValues1Searched.join("\n") : "一致するものは見つかりませんでした。";
                break;
    case "all": return colValues1.join("\n");
                break;
    case "1ヶ月":
    case "一ヶ月": (thisMonth-1 < 1) ? setDate.setMonth(11) && setDate.setFullYear(thisYear-1) : setDate.setMonth(thisMonth-2);
                  return fetchDataOfColValues1WhereColValues2Exist();
                  break;
    case "半年": (thisMonth-6 < 6) ? setDate.setMonth(12+(thisMonth-7)) && setDate.setFullYear(thisYear-1) : setDate.setMonth(thisMonth-7);
                 return fetchDataOfColValues1WhereColValues2Exist();
                 break;
    case "登録一覧":
    case "次回一覧":
    case "宿題一覧": allValuesOnSheet.forEach(function(value) {
                    if (value[2].length > 0 && value[2] == status.replace("一覧","") ){
                        colValues1Searched.push(value[0]);
                    }
                    });      　　　　　　　　　　　　　　　　　　　　　　　　　　　　　
                    return colValues1Searched.length > 0 ? colValues1Searched.join("\n") : "一致するものは見つかりませんでした。";  
  }
}

//毎月一回入出金額と貯金残高をこのスクリプトと連携したLINE公式アカウントに通知してくれるメソッド
function notifyHouseholdAccountBookOnceAMonth() {
  var spreadSheetId = fetchTheSpreadSheet();
  var spreadSheet = SpreadsheetApp.openById(spreadSheetId);
  var sheets = spreadSheet.getSheets();
  var allValuesOnSheet = sheets[2].getRange(1,1,sheets[2].getLastRow(),3).getValues();
  var setDate = new Date();
  var thisYear = setDate.getFullYear();
  var thisMonth = (setDate.getMonth() + 1);
  (thisMonth-1 < 1) ? setDate.setMonth(11) && setDate.setFullYear(thisYear-1) : setDate.setMonth(thisMonth-2);
  
  function fetchDataOfColValues1WhereStatusIs(statusForSearching) {
    var colValues1Searched = [];
      allValuesOnSheet.forEach(function(value) {
        if (value[1].getTime() >= setDate.getTime() && value[2].indexOf(statusForSearching) >= 0) {
          colValues1Searched.push(value[0]);
        }
      });
  return colValues1Searched.length > 0 ? colValues1Searched.reduce(function(a, b) {return a + b;}) : "一致するものは見つかりませんでした。";
  }
  
  var depositsInThisMonth = fetchDataOfColValues1WhereStatusIs("入金");
  var withdrawalsInThisMonth = fetchDataOfColValues1WhereStatusIs("出金");
  var balance = fetchDataOfColValues1WhereStatusIs("残高") + depositsInThisMonth - withdrawalsInThisMonth;
  insertDataInTheHouseholdAccountBook("残高", sheets[2], balance)
  
  pushMessage("今月の入金額: " + depositsInThisMonth + "円\n" + "今月の出金額: " + withdrawalsInThisMonth + "円\n" + "残高: " + balance + "円"); 
}

//このスクリプトと連携したLINE公式アカウントにメッセージを送るためのメソッド
function pushMessage(test) {
    //deleteTrigger();
  var postData = {
    "to": USER_ID,
    "messages": [{
      "type": "text",
      "text": test
    }]
  };

  var url = "https://api.line.me/v2/bot/message/push";
  var headers = {
    "Content-Type": "application/json",
    'Authorization': 'Bearer ' + LINE_MEMO_ACCESS_TOKEN,
  };

  var options = {
    "method": "post",
    "headers": headers,
    "payload": JSON.stringify(postData)
  };
  var response = UrlFetchApp.fetch(url, options);
}