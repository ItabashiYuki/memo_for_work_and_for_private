var LINE_MEMO_ACCESS_TOKEN = "<このスクリプトと連携したLINE公式アカウントのトークン>";            
var USER_ID = "<myLINEアカウントのトークン>";

function doPost(e) {
  const accountAttribute = (e.parameter.text == undefined) ? "LINE" : "Slack";
  
  if (accountAttribute == "LINE"){
    const webhookData = JSON.parse(e.postData.contents).events[0];
    var token = webhookData.replyToken;
    var message = webhookData.message.text;
  }else {
    if (e.parameter.user_name != "slackbot"){
      token = e.parameter.token;
      message = e.parameter.text;
    }
  }
  return (message == undefined) ? false : sendResponse(accountAttribute,token,message);
}

function sendResponse(accountAttribute,token,message){
 const spreadSheetId = fetchTheSpreadSheet();
 const spreadSheet = SpreadsheetApp.openById(spreadSheetId);
 const sheets = spreadSheet.getSheets();
 const splitedMessage = message.split(" ");
  
 switch (accountAttribute) {
   case "LINE":  var sheet;
                 const statusForSelectingSheet = /^入金|出金$/;
                 (statusForSelectingSheet.test(splitedMessage[0])) ? sheet = sheets[2] : sheet = sheets[0];
                 var parsedResult = parseStatus(sheet, splitedMessage);
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
   case "Slack":  parsedResult = parseStatus(sheets[1], splitedMessage); 
                  url = "https://hooks.slack.com/services/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";
                  postData = {
                   "text" : parsedResult
                 };
                  headers = {
                   "Content-Type" : "application/json; charset=UTF-8"
                 };
                 break;         
 }
 const options = {
                  "method":"POST",
                  "headers": headers,
                  "payload": JSON.stringify(postData)
                };
 return UrlFetchApp.fetch(url, options);  
}

//データベース代わりに活用しているスプレッドシートの情報を取ってくる関数
function fetchTheSpreadSheet() {
  const userProperties = PropertiesService.getUserProperties();
  var spreadSheetId = userProperties.getProperty('SPREAD_SHEET_ID');
  
  if(!spreadSheetId) {
    const newSpreadSheet = SpreadsheetApp.create('管理スプレッドシート');
    const sheetsToBeMade = ["MEMOForPrivate","MEMOForWork","家計簿"];
    sheetsToBeMade.forEach(function(value,index){
      newSpreadSheet.insertSheet(value,index);
    });
    userProperties.setProperty('SPREAD_SHEET_ID', newSpreadSheet.getId());
    spreadSheetId = userProperties.getProperty('SPREAD_SHEET_ID');
  }
  return spreadSheetId;
}

function parseStatus(sheet, splitedMessage) {
　　　　const statusForSearchingData =/^検索|all|1ヶ月|一ヶ月|半年|登録一覧|次回一覧|宿題一覧$/;
  const statusForDepositsAndWithdrawals = /^入金|出金$/;
  if (statusForSearchingData.test(splitedMessage[0])) {
    return searchDataInTheSpreadSheet(splitedMessage[0], sheet, splitedMessage[1]);
  }else if(statusForDepositsAndWithdrawals.test(splitedMessage[0])) {
    return insertDataInTheHouseholdAccountBook(splitedMessage[0], sheet, splitedMessage[1]);
  }  
  return insertDataInTheSpreadSheet(splitedMessage[0], sheet, splitedMessage[1]); 
}

//MEMOForPrivateテーブルかMEMOForWorkテーブル内にデータを挿入する関数
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

//家計簿テーブル内にデータを挿入する関数
function insertDataInTheHouseholdAccountBook(status, sheet, message) {
  var today = new Date();
  const gottenDate = today.getDate();
  
  (status == "残高") ? today.setDate(gottenDate+10) : today;
  sheet.appendRow([message, today, status]);
  return "処理を受付けました。";
}

//MEMOForPrivateテーブルとMEMOForWorkテーブル内のデータを検索する関数
function searchDataInTheSpreadSheet(status, sheet, message) {
  const valuesOfColumn1 = sheet.getRange(1,1,sheet.getLastRow(),1).getValues();
  var valuesOfColumn1Searched = [];
  const allValuesOnSheet = sheet.getRange(1,1,sheet.getLastRow(),3).getValues();
  var setDate = new Date();
  const thisYear = setDate.getFullYear();
  const thisMonth = (setDate.getMonth() + 1);
  
  function fetchDataOfValuesOfColumn1WhereValuesOfColumn2Exist() {
      allValuesOnSheet.forEach(function(value) {
        if (value[1].getTime() >= setDate.getTime()){
          valuesOfColumn1Searched.push(value[0]);
        }
     });
  return valuesOfColumn1Searched.length > 0 ? valuesOfColumn1Searched.join("\n") : "一致するものは見つかりませんでした。";
  }
  
  switch (status) { 
    case "検索": allValuesOnSheet.forEach(function(value) {
                  if (value[0].indexOf(message) >= 0){
                    valuesOfColumn1Searched.push(value[0]);
                  }
                });
                return valuesOfColumn1Searched.length > 0 ? valuesOfColumn1Searched.join("\n") : "一致するものは見つかりませんでした。";
                break;
    case "all": return valuesOfColumn1.join("\n");
                break;
    case "1ヶ月":
    case "一ヶ月": (thisMonth-1 < 1) ? setDate.setMonth(11) && setDate.setFullYear(thisYear-1) : setDate.setMonth(thisMonth-2);
                  return fetchDataOfValuesOfColumn1WhereValuesOfColumn2Exist();
                  break;
    case "半年": (thisMonth-6 < 6) ? setDate.setMonth(12+(thisMonth-7)) && setDate.setFullYear(thisYear-1) : setDate.setMonth(thisMonth-7);
                 return fetchDataOfValuesOfColumn1WhereValuesOfColumn2Exist();
                 break;
    case "登録一覧":
    case "次回一覧":
    case "宿題一覧": allValuesOnSheet.forEach(function(value) {
                    if (value[2].length > 0 && value[2] == status.replace("一覧","") ){
                        valuesOfColumn1Searched.push(value[0]);
                    }
                    });      　　　　　　　　　　　　　　　　　　　　　　　　　　　　　
                    return valuesOfColumn1Searched.length > 0 ? valuesOfColumn1Searched.join("\n") : "一致するものは見つかりませんでした。";  
  }
}

//毎月一回入出金額と貯金残高をこのスクリプトと連携したLINE公式アカウントに通知してくれる関数
function notifyHouseholdAccountBookOnceAMonth() {
  const spreadSheetId = fetchTheSpreadSheet();
  const spreadSheet = SpreadsheetApp.openById(spreadSheetId);
  const sheets = spreadSheet.getSheets();
  const allValuesOnSheet = sheets[2].getRange(1,1,sheets[2].getLastRow(),3).getValues();
  var setDate = new Date();
  const thisYear = setDate.getFullYear();
  const thisMonth = (setDate.getMonth() + 1);
  (thisMonth-1 < 1) ? setDate.setMonth(11) && setDate.setFullYear(thisYear-1) : setDate.setMonth(thisMonth-2);
  
  function fetchDataOfValuesOfColumn1WhereStatusIs(statusForSearching) {
    var valuesOfColumn1Searched = [];
      allValuesOnSheet.forEach(function(value) {
        if (value[1].getTime() >= setDate.getTime() && value[2].indexOf(statusForSearching) >= 0) {
          valuesOfColumn1Searched.push(value[0]);
        }
      });
  return valuesOfColumn1Searched.length > 0 ? valuesOfColumn1Searched.reduce(function(a, b) {return a + b;}) : "一致するものは見つかりませんでした。";
  }
  
  const depositsInThisMonth = fetchDataOfValuesOfColumn1WhereStatusIs("入金");
  const withdrawalsInThisMonth = fetchDataOfValuesOfColumn1WhereStatusIs("出金");
  const balance = fetchDataOfValuesOfColumn1WhereStatusIs("残高") + depositsInThisMonth - withdrawalsInThisMonth;
  insertDataInTheHouseholdAccountBook("残高", sheets[2], balance);
  
  pushMessage("今月の入金額: " + depositsInThisMonth + "円\n" + "今月の出金額: " + withdrawalsInThisMonth + "円\n" + "残高: " + balance + "円"); 
}

//このスクリプトと連携したLINE公式アカウントにメッセージを送るための関数
function pushMessage(test) {
    //devareTrigger();
  const postData = {
    "to": USER_ID,
    "messages": [{
      "type": "text",
      "text": test
    }]
  };

  const url = "https://api.line.me/v2/bot/message/push";
  const headers = {
    "Content-Type": "application/json",
    'Authorization': 'Bearer ' + LINE_MEMO_ACCESS_TOKEN,
  };

  const options = {
    "method": "post",
    "headers": headers,
    "payload": JSON.stringify(postData)
  };
  const response = UrlFetchApp.fetch(url, options);
}