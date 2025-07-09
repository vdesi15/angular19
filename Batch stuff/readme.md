ok.. next I want you to do following things - 

1) When user click on Upload to JIRA in transaction toolbar - It shows up a dialog to attach the zip file to JIRA ID. 2) There are 4 types of JIRA items - JIRA ID - "<someappname>-<somenumber>" , Test Case Format - "<someappname>-T<num>", TestCycle - <someappname>-C<num> and Executions <someappname>-E<num>

And similarly, I want to also pick out the IDs from JIRA URL - test cycle -  http://jira/..../testPlayer/App-C111 or testcase - http://jira/..../testcase/App-T111 or JIRA item - http://jira/..../.../App-111 and then do the next -

1.1) User enters test cycle

   1.1.1) I want all JIRA logic in JIRA service. When user enters a test cycle "App-C10" (for example), I want the dialog to detect that and change the buttons at the bottom of the fotter -> "Get Associated Executions" , "Upload to App-C10", "Close" 

   1.1.2) If user clicks on "Get Associated Executions" then I need to connect and get data from end point - `${api_endpoint}/jira/getTestCycle/getTestCycleExecutions/${testCycleId}` this will return this array of objects, I am not adding all properties in the object, I dont think we need to create a model since we are going to be looking at few values - 

   Once we get the below object, I want to load the modal/dialog with the table and following columns, 

   |  | Test Case Id | Execution Id | Status|
   |--|--------------|--------------|-------|
   |checkbox|App-T11<href to testcase-url>|App-E33<href to execution url>|status|
   |checkbox|App-T12<href to testcase-url>|App-E34<href to execution url>|status|
   ....

   [

      {
         ....
         id: 12345
         testCaseKey: "App-T11"
         testcase-url: "http://..../App-T11"
         key: "App-E33"
         key-url: "http://..../App-E33"
         status: "Pass/Fail"
         ....
      },
      {
         ....
         id: 435453
         testCaseKey: "App-T12"
         testcase-url: "http://..../App-T12"
         key: "App-E34"
         key-url: "http://..../App-E34"
         status: "Pass/Fail"
         ....
      }
   ]


   When user can pick multiple rows, but once a row is selected, Hide the button "Get Associated Executions" and add "Upload to selected Executions", keep the othe 2 button - "Upload to App-CXX" (to associate with test cycle) and "Close" button the same,

   1.1.3) When user clicks "Upload to selected executions" do the following -> Loop through each selected exection and make this POST call with the body containing file:<binaydata of file> -> `${api_endpoint}/jira/uploadAttachments/App-C10(test cycle enterd by user)-${id} (id of the row)`. Show a message at teh top of teh dialog saying attached successfully ocne the response is good.

   fhte file is the zip file with the same logic we do for download zip.

1.2) User enters Test Case for example "App-T34"
   1.2.1) Show on "Upload" and "Close" buttons.   
   1.3.2) Zip the file with all teh content like we do for download.
   1.2.3) Then make this POST call with the body containing file:<binaydata of file> -> `${api_endpoint}/jira/uploadAttachments/App-T34`. Show a message at the top of teh dialog saying attached successfully ocne the response is good.

1.3) User enters a normal Jira ID - "App-123", 
   1.3.1) Show on "Upload" and "Close" buttons.
   1.3.2) Zip the file with all teh content like we do for download.
   1.3.3) Then make this POST call with the body containing file:<binaydata of file> -> `${api_endpoint}/jira/uploadAttachments/App-123`. Show a message at the top of teh dialog saying attached successfully ocne the response is good.

1.4) Now if the user enters an ExecutionId like this - "App-E112" -> Then disable all buttons execpt "Close" and show an error message on dialog saying "Direct uploads to Executions not supported. Pick a test cycle to upload to execution"

1.5) any other format other than "App-123" or "App-C12" or "App-T213" or "App-E23" or any http links with these ID, show a message saying invlid JIRA format.


Do not over complicate things, do not create models id not needed. Make the code very performant, use Angular 19 patters (signals/linkedsignals) etc. Make the dialogs adn UI looks super professional. Go through the existing github code before responding.