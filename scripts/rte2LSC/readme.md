
* default 
{{customText(255|DefaultText)}} 255-character field with default text

{{customText[Opt1|Opt2|Opt3]}} Dropdown selection options
{{customText[ |option1 |option2|option3]}}. //WHITE OPTION SUPPORTED

* with inner variables
{{customText[option1|option2|##userName##]}}
{{customText[option1|option2| ]}} //white options also supported


//Image. (hard-code values manually)
<img src="{{{sender.useradditionalinfo.userpictureurl}}}" alt="" height="auto" width="160" />

no supported: 
  "{{customText(Length)}}": `<span class="LSC_DropDownInput"></span>`,

Fragments:
- Has to be in a <td> tag always cause what renders inside is a <table>

Preheaders:
Remote all tags and nested tags with the following properties: id="preheader" / class="preheader"


Unsubscribe:

{{unsubscribe_product_link}} 


//Images in fragments are auto renamed with folder name.

//fragments html files names has to be unique across entire template.
 
//fragment tokens are auto replaced same as the index.html template.

// paths for all fragment images are auto renamed to work with lsc




