import 'geckodriver'

import {getDriver} from '../application-area/driverUtil'
import config from '../application-area/config'
import {addParagraphs, addTextToParagraph, closeBrowser, doChat, login, removeParagraphs} from '../businessComponents';
import {WebDriver} from 'selenium-webdriver';

describe('Start Editor', () => {
  const rootURL = config.rootURL
  const nrOfClients = config.nrOfClients
  jest.setTimeout(300000)
  const clientArray = new Array<Promise<void>>(nrOfClients)
  const driverArray = new Array<WebDriver>(nrOfClients)

  it('should open editor', async () => {
    for (let i = 0; i < nrOfClients; i++) {
      driverArray[i] = await getDriver()
      clientArray[i] = login(driverArray[i], rootURL)
      await driverArray[i].sleep(1000)
    }
    await Promise.all(clientArray);
  })
  it('should add paragraphs', async () => {
    for (let i = 0; i < nrOfClients; i++) {
      clientArray[i] = addParagraphs(driverArray[i])
    }
    await Promise.all(clientArray);
  })
  it('should chat', async () => {
    for (let i = 0; i < nrOfClients; i++) {
      clientArray[i] = doChat(driverArray[i])
    }
    await Promise.all(clientArray);
  })
  it('should add text', async () => {
    for (let i = 0; i < nrOfClients; i++) {
      clientArray[i] = addTextToParagraph(driverArray[i])
    }
    await Promise.all(clientArray);
  })

  it('should remove paragraphs', async () => {
    for (let i = 0; i < nrOfClients; i++) {
      clientArray[i] = removeParagraphs(driverArray[i])
    }
    await Promise.all(clientArray);
  })
  it('should close browser', async () => {
    for (let i = 0; i < nrOfClients; i++) {
      clientArray[i] = closeBrowser(driverArray[i])
    }
    await Promise.all(clientArray);
  })
});
