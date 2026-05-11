/* key= veeva 
value = lsc */


const tokensMap = {

    "{{accFname}}": "{{recipient.firstname}}",
    "{{accLname}}": "{{recipient.lastname}}",
    "{{accTitle}}": "{{recipient.title}}",
    "{{User.FirstName}}": "{{sender.firstname}}",
    "{{User.LastName}}": "{{sender.lastname}}",
    "{{userName}}": "{{sender.name}}",
    "{{userEmailAddress}}": "{{sender.email}}",
    "{{User.Phone}}": "{{sender.phone}}",
    "{{User.MobilePhone}}": "{{sender.mobilePhone}}",
    "{{User.Title}}": "{{sender.title}}",

    "{{PieceLink}}" : "{{Content.Asset_URL}}",
    "{{surveyLink}}" : "{{Survey.Link}}",
    "{{parentCallDatetime}}" : "{{visit.PlannedVisitStartTime}}",
/*     "" : "",
    "" : "",
    "" : "",
    "" : "",
    "" : "",
    "" : "",
    "" : "",
    "" : "", */
}



