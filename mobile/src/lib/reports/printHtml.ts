/** Print only the given HTML — never the surrounding app chrome. */
export function printHtmlDocument(html: string) {
  return new Promise<void>((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("Printing is not available"));
      return;
    }
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const win = iframe.contentWindow;
    const doc = iframe.contentDocument;
    if (!win || !doc) {
      iframe.remove();
      reject(new Error("Could not open print frame"));
      return;
    }

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      iframe.remove();
      resolve();
    };

    doc.open();
    doc.write(html);
    doc.close();
    win.onafterprint = finish;
    window.setTimeout(() => {
      win.focus();
      win.print();
    }, 50);
    window.setTimeout(finish, 60_000);
  });
}
