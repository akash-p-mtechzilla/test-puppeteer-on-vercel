import type { NextApiRequest, NextApiResponse } from "next";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium"

const IS_DEVELOPMENT = process.env.NODE_ENV === "development";

const getOptions = async () => {
  if (IS_DEVELOPMENT) {
    return {
      args: ["--no-sandbox"],
      executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      headless: true,
    };
  }


  return {
    args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: true,
    ignoreHTTPSErrors: true,
  };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  let browser;

  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    const options = await getOptions();

    console.log("Environment:", process.env.NODE_ENV);
    console.log("Platform:", process.platform);
    console.log("Chrome options:", {
      executablePath: options.executablePath,
      args: options.args,
      headless: options.headless,
    });

    browser = await puppeteer.launch(options);
    const page = await browser.newPage();

    if (!page) {
      throw new Error("Failed to create new page");
    }

    page.setDefaultNavigationTimeout(30000);
    page.setDefaultTimeout(30000);

    await page.setViewport({
      width: 1200,
      height: 800,
    });

    await page.goto(url, {
      waitUntil: ["networkidle0", "domcontentloaded"],
      timeout: 30000,
    });

    const pdf = await page.pdf({
      format: "a4",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      margin: {
        top: "90px",
        bottom: "32px",
        left: "32px",
        right: "32px",
      },
    });

    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=document.pdf"
    );

    res.status(200).end(pdf);
  } catch (error) {
    console.error("PDF Generation Error:", error);
    if (browser) {
      await browser.close();
    }
    return res.status(500).json({
      error: "Failed to generate PDF",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export const config = {
  maxDuration: 60,
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
    responseLimit: "10mb",
  },
};

