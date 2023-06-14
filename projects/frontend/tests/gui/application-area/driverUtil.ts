import { Builder, WebDriver } from 'selenium-webdriver'
import { Options } from 'selenium-webdriver/firefox'
import config from './config';

export const getDriver = async (): Promise<WebDriver> => {
  const ffOptions = new Options()
  if (config.runHeadLess) ffOptions.addArguments('--headless')
  const driver: WebDriver = new Builder().forBrowser('firefox').setFirefoxOptions(ffOptions).build()
  await driver.manage().setTimeouts({ implicit: 10000 })
  return driver
}
