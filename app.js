/* Параметры, которые нужно ввести */
const BINANCE_APIKEY = 'your_apikey';
const BINANCE_SECRET = 'your_secret';

/* Код, далее уже логика */
const crypto = require('crypto');
const readline = require('readline');

const {
  setLeverage,
} = require('./binance/set-leverage');

const {
  getLeverageBracketsData,
} = require('./binance/get-leverage-brackets');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const askQuestion = () => {
  rl.question('Введите плечо\n', answer => {
    if (!answer) {
      console.log('Вы ничего не ввели');
      return askQuestion();
    }

    const numberAnswer = parseInt(answer, 10);

    if (Number.isNaN(numberAnswer)
      || numberAnswer < 0
      || numberAnswer > 125) {
      console.log('Невалидные данные');
      return askQuestion();
    }

    setLeverageForAllInstruments(numberAnswer);
  });
};

const setLeverageForAllInstruments = async myLeverage => {
  console.log('Это может занять некоторое время');

  const timestamp = new Date().getTime();

  let signature = crypto
    .createHmac('sha256', BINANCE_SECRET)
    .update(`timestamp=${timestamp}`)
    .digest('hex');

  const resultGetLeverageBracketsData = await getLeverageBracketsData({
    signature,
    timestamp,
    apikey: BINANCE_APIKEY,
  });

  if (!resultGetLeverageBracketsData || !resultGetLeverageBracketsData.status) {
    console.log(resultGetLeverageBracketsData.message || 'Cant getLeverageBracketsData');
    return false;
  }

  await (async () => {
    const lSymbols = resultGetLeverageBracketsData.result.length;

    for (let i = 0; i < lSymbols; i += 1) {
      const symbolObj = resultGetLeverageBracketsData.result[i];

      if (!symbolObj.symbol.includes('USDT')) {
        continue;
      }

      let maxLeverage = symbolObj.brackets[0].initialLeverage;

      symbolObj.brackets.forEach(bracket => {
        if (maxLeverage < bracket.initialLeverage) {
          maxLeverage = bracket.initialLeverage;
        }
      });

      if (maxLeverage < myLeverage) {
        console.log(`symbol: ${symbolObj.symbol}, maxLeverage: ${maxLeverage}. Skip`);
        continue;
      }

      signature = crypto
        .createHmac('sha256', BINANCE_SECRET)
        .update(`symbol=${symbolObj.symbol}&leverage=${myLeverage}&timestamp=${timestamp}`)
        .digest('hex');

      const resultSetLeverage = await setLeverage({
        timestamp,
        signature,
        leverage: myLeverage,
        symbol: symbolObj.symbol,
        apikey: BINANCE_APIKEY,
      });

      if (!resultSetLeverage || !resultSetLeverage.status) {
        console.log(resultSetLeverage.message || 'Cant setLeverage');
        continue;
      }

      await sleep(500);
      console.log(`Ended ${symbolObj.symbol}`);
    }
  })();
};

const sleep = ms => {
  return new Promise(resolve => setTimeout(resolve, ms));
};


askQuestion();
