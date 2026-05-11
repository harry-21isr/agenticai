import * as ticketInfo from "../../src/ticket-info.js";


export const variablesReplacementHandler = (html) => {

  let htmlWithVariables = html;

  if (typeof ticketInfo?.variablesToReplace !== "undefined" && Object.keys(ticketInfo?.variablesToReplace).length > 0) {
    htmlWithVariables =  Object.entries(ticketInfo?.variablesToReplace).reduce(
      (result, [placeholder, value]) => result.replaceAll(placeholder, value),
      html
    );
    console.log("\n✅ - Text Variables found and replaced.")
  }
  else {
    console.log("\n⚠️ - NO text variables found!")
  }
  return htmlWithVariables

}