

export const CANVAS_AUTOMATIONS = {
    //Update line-heights for fonts. Percentages are calculated to its corresponding pixel value and invert sizes when child elements are bigger than parent ones.
    UPDATE_LINEHEIGHTS: true,
    
    //Sets inline CSS color to #0000ee and text decoration to underline for <a> elements that do not contain <img> elements.
    SET_LINK_TYLES: true,

    //Apply to "{{userEmailAddress}} {{User.Phone}} {{User.MobilePhone}}" tokens the bluelink fix and makes all <a> with href="#" as no clickable
    SET_LINKS_UNCLICKABLE: true,

    //Replace some tags like: b => strong, i => em and some char by its corresponding value like: %7B%7B => {{, %5D => ], 0px => 0, Also token fixing like: custom Text => customText
    UPDATE_HTMLTAGS: true,

    //Update veeva tokens.
    UPDATE_VEEVATOKENS: true,

    //Updates inline padding styles in the provided HTML string by parsing it with jsdom, and converting longhand padding properties to shorthand where applicable.
    UPDATE_PADDINGS: true,

    //Takes all buttons and convert them into a fixed version that is bulletproof.
    UPDATE_OUTLOOK_BUTTONS: true,

    // Takes rgb/a values and translate them into hexadecimal values.
    CONVERT_RGB_HEX: true,

    //Applies <a> tag containing gmail fix to all images who doesnt have it, if img already contains an anchor with some href link on it, it does perserve it and injects extra values to make it clickable if href=# or href="tbd" convert them into no clickable
    ADD_IMG_GMAILFIX: true,

    //Takes global css configuration and applies it to overall email: Example: (border-collapse: collapse to a <table> <td>), (border: 0 for images), (margin=0 for body)
    UPDATE_GLOBALCSS: true,

    //Take lang value from "src --> ticket-info.html" and injects lang="" and xml:lang="".
    ADD_LANG: true,

    //Takes chars into ascci codes (ex: "®": to "&reg;") 
    CONVERT_CHARS_ASCII: true,

    //Minify Email
    MINIFY: true,

    //Update preheader text to add extra white spaces, prevent OL <fin> issue and make it functional for veeva upload.
    UPDATE_PREHEADER: true,

    //hyphenated compound word keeps the word joined adding &zwj; at the beginning and end of the hyphen ex: (widow&zwj;-&zwjword)
    HYPHENATED_WORD: true,

    //Inject &\u200D; after 2 consecutive digits (01800 = 01&\u200D80&\u200D0) 
    BREAK_CONSECUTIVE_NUMBERS: true,
    
    //finds all &\u200D chars and convert them into &zwj;
    ENCODED_ZWJ_TO_ASCII: true
}