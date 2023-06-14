import {By, until, WebDriver} from 'selenium-webdriver';
import {getElementByDataTest, getElementsByDataTest, getRandomString, waitWhileLoading} from './application-area/utils';
import {getRandomName} from '@fhnw/wodss-shared/src/core/util';

export async function login(driver: WebDriver, rootUrl: string): Promise<void> {
  await driver.navigate().to(rootUrl)
  await waitWhileLoading(driver)
  await driver.wait(until.elementLocated(By.css('[data-test="email"]')), 20000)
  const emailField = await getElementByDataTest('email', driver);
  await emailField.clear()
  const randomName = getRandomName()
  await emailField.sendKeys(randomName[0] + '.' + randomName[1] + '@test.ch')
  const loginButton = await getElementByDataTest('login', driver);
  await waitWhileLoading(driver)
  await driver.sleep(1000)
  await loginButton.click()
  await waitWhileLoading(driver)

  const menuListItems = await getElementsByDataTest('navigationElement', driver);
  await menuListItems.at(1)?.click()
}

export async function removeParagraphs(driver: WebDriver): Promise<void> {
  try {
    while ((await getElementsByDataTest('paragraph', driver)).length !== 0) {
      const paragraph = (await getElementsByDataTest('paragraph', driver)).pop();
      await paragraph?.click();
      const deleteButton = await getElementsByDataTest('deleteParagraph', driver)
      await deleteButton.pop()?.click()
    }
  } catch (e) {}
}

export async function addParagraphs(driver: WebDriver): Promise<void> {
  if ((await getElementsByDataTest('paragraph', driver)).length === 0) {
    const addParagraph = await getElementByDataTest('addParagraph', driver)
    await addParagraph.click()
  }
  for (let i = 0; i < 10; i++) {
    try {
      const paragraph = (await getElementsByDataTest('paragraph', driver)).pop();
      await paragraph?.click()
      const addAboveButton = (await getElementsByDataTest('addParagraphAbove', driver)).pop();
      await addAboveButton?.click()
    } catch (e) {}
  }
}

export async function doChat(driver: WebDriver): Promise<void> {
  for (let i = 0; i < 5; i++) {
    const chatInput = await getElementByDataTest('chatInput', driver)
    const messageText = getRandomString(50)
    await chatInput.click()
    await driver.sleep(100)
    await chatInput.sendKeys(messageText)
    const chatSubmit = await getElementByDataTest('chatSend', driver);
    await driver.sleep(500)
    await chatSubmit.click();
    await driver.sleep(200)
    const chatMessages = await getElementsByDataTest('chatMessage', driver);
    expect(chatMessages.find(async (msg) => await msg.getText() === messageText)).not.toBeUndefined()
  }
}

export async function addTextToParagraph(driver: WebDriver): Promise<void> {
  for (let i = 0; i < 5; i++) {
    try {
      const paragraph = (await getElementsByDataTest('paragraph', driver));
      const paragraphIndex = Math.floor((paragraph.length - 1) * Math.random())
      await paragraph.at(paragraphIndex)?.click()
      const editParagraphButton = (await getElementsByDataTest('editParagraph', driver)).at(paragraphIndex);
      await editParagraphButton?.click()
      await getElementByDataTest('editor', driver)
      for (let i = 0; i < 500; i++) {
        await driver.actions().sendKeys(getRandomString(5)).perform()
      }

      await editParagraphButton?.click();
    } catch (e) {}
  }
}

export async function closeBrowser(driver: WebDriver): Promise<void> {
  return await driver.close();
}
