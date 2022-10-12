function copy() {
    let copyText = window.location.href;
    navigator.clipboard.writeText(copyText);
    alert("URL Copied");
}

