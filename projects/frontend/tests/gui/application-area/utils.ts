import { By, until, WebDriver, WebElement } from 'selenium-webdriver'
import fs from 'fs'

const waitUntilTime = 20000

export async function querySelector (selector: string, driver: WebDriver): Promise<WebElement> {
  const el = await driver.wait(until.elementLocated(By.css(selector)), waitUntilTime)
  return driver.wait(until.elementIsVisible(el), waitUntilTime)
}

export async function waitWhileLoading(driver: WebDriver) :Promise<boolean> {
  return await driver.wait(async () => {
    return (!(await driver.getPageSource()).includes('loadingScreen'))
  }, 10000, 'wait')
}

export function getRandomString(nrOfChars: number): string {
  const length = Math.floor(Math.random() * nrOfChars);
  return Array(length)
    .fill('')
    .map((_, i) => i % 10 ? Math.floor(Math.random() * 36).toString(36) : ' ')
    .join('');
}

export async function getElementByDataTest(dataTest: string, driver: WebDriver): Promise<WebElement> {
  return driver.findElement(By.css(`[data-test="${dataTest}"]`))
}

export async function getElementsByDataTest(dataTest: string, driver: WebDriver): Promise<WebElement[]> {
  return driver.findElements(By.css(`[data-test="${dataTest}"]`))
}
export async function verifyWebElementText (elementPromise: Promise<WebElement>, expectedText: string): Promise<void> {
  elementPromise.then(async (element) => {
    const result = await element.getText()
    expect(result).toEqual(expectedText)
  })
}
export const screenShot = (driver: WebDriver, outName: string): void => {
  driver.takeScreenshot().then((data) => {
    const base64Data = data.replace(/^data:image\/png;base64,/, '')
    fs.writeFile(outName + '.png', base64Data, 'base64', (err) => {
      if (err) console.log(err)
    })
  })
}
