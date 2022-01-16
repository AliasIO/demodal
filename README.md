
# Demodal

Demodal is a browser extension that automatically removes content blocking modals including paywalls, 
discount offers, promts to sign up or enter your email address and more.

Modal dialogues such as paywalls, discount offers, cookie prompts and GDPR 
banners are user-hostile interfaces that demand your attention and interrupt
your browsing experience. Demodal puts you back in control, letting you
focus on the content.

# Installation

### Google Chrome

https://chrome.google.com/webstore/detail/demodal/fjhbdkfknppikobblnjibmkmogjeffcf

Install locally:

* Clone this repository
* Run `./run manifest v3` or copy `manifest-v3.json` to `manifest.json`
* Go go `about:extensions`
* Enable 'Developer mode'
* Click 'Load unpacked'
* Select the project folder

### Mozilla Firefox

https://addons.mozilla.org/firefox/addon/demodal

Install locally:

* Clone this repository
* Run `./run manifest v2` or copy `manifest-v2.json` to `manifest.json`
* Go go `about:debugging#/runtime/this-firefox`
* Click 'Load Temporary Add-on'
* Select `manifest.json`


# Contributing

**This extension is in early development. You can help by reporting
websites with modals that didn't get blocked, or by creating your own
definitions and sharing them with us and the community. The aim is to build up
a comprehensive set of rules over time to block modals anywhere.**

Demodal is not an ad-blocker. Only create definitions for UI elements that intefere with reading of content.

When submitting a pull request, please include a screenshot of the element that's being blocked and a link to a website to test.

Every definition should clearly match one modal type (e.g. consent request or paywall). Don't create overly broad definitions (e.g. `div.modal`) that could block legimitate modals.


# Specification

## Modal types

| Type       | Description  |
|------------|--------------|
| `consent`  | Cookie and GDPR notices.
| `donate`   | Prompts to make a donation.
| `email`    | Prompts to enter your email address.
| `message`  | General messages and notifications.
| `offer`    | Promotions and discounts.
| `paywall`  | Prompts to sign up for a paid subscription.
| `signup`   | Prompts to create an account.

## Definitions

Definitions are located in [`/definitions`](/definitions), file-separated by modal type. Definitions are grouped by URL pattern.

```javascript
{
  "<glob> [ <glob> ... ]": { // URL pattern
    // Definition
    "if <function> [ <function> ... ]": { // Condition
      "<selector>": "<function> [ <argument> ... ]" // Action
    },
    // Definition (shorthand, no condition)
    "<selector>": "<function> [ <argument> ... ]" // Action
  }
}
```

**Examples**
```javascript
{
  "*.example.com *.example.org": {
    "if $(.modal)": {
      ".modal": "remove" // Remove element if present
    },
    ".modal": "addClass hide" // Remove element (shorthand)
    "if defined(ModalDialog)": {
      "ModalDialog.close": "call" // Call function if defined
    },
    "if defined(ModalDialog)": {
      "ModalDialog.setClosed": "call true" // Call function with arguments
    },      
  }
}
```

## URL pattern
URL patterns are defined as [globs](https://en.wikipedia.org/wiki/Glob_(programming)), allowing wildcards (`*`).

| Glob                      | Matches |
|---------------------------|---------|
| `*`                       | Any URL.
| `*.example.com`           | Apex domain and any subdomain, e.g. `example.com`, `www.example.com`.
| `example.com example.org` | `example.com` and `example.org`.
| `*.example.com/*/about`   | E.g. `www.example.com/en/about`.

## Conditions

Conditions start with `if`, followed by one or more functions. If all functions evaluate to `true`, the specified actions are run.

### Functions

| Function    | Argument             | Description |
|-------------|----------------------|-------------|
| `$()`       | [Query selector](https://developer.mozilla.org/docs/Web/API/Document/querySelector) | Tests if an HTML element exists.
| `defined()` | JavaScript property  | Tests if a JavaScript property exists.
| `sleep()`   | Time in milliseconds | Returns true after the specified time has passed

## Actions

Actions are run when the condition is met, or if no condition is specified.

### Functions

| Function      | Argument   | Description |
|---------------|------------|-------------|
| `remove` .    |            | Remove the HTML element
| `addClass`    | Class name | Add a class
| `removeClass` | Class name | Remove a class
| `addStyle`    | Styles     | Appends CSS to the style attribute
| `removeStyle` |            | Clears the style attribute
| `click`       |            | Click the HTML element
| `call`        |            | Call the function. Any arguments will be passed to the function.


