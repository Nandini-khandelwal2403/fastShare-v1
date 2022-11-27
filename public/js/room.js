function copy() {
    const link = location.href;
    navigator.clipboard.writeText(link);
    alert("Text Copied");
}