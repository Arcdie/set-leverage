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

let USER_LEVERAGE = 25;
let BINANCE_APIKEY = 'your_apikey';
let BINANCE_SECRET = 'your_secret';

const askQuestion = (numberStep = 0) => {
  let question;

  if (numberStep === 0) {
    rl.question('Введите плечо\n', answer => {
      if (!answer) {
        console.log('Вы ничего не ввели');
        return askQuestion(0);
      }

      const numberAnswer = parseInt(answer, 10);

      if (Number.isNaN(numberAnswer)
        || numberAnswer < 0
        || numberAnswer > 125) {
        console.log('Невалидные данные');
        return askQuestion(0);
      }

      USER_LEVERAGE = numberAnswer;
      return askQuestion(1);
    });
  } else if (numberStep === 1) {
    rl.question('Введите binance apikey\n', answer => {
      if (!answer) {
        console.log('Вы ничего не ввели');
        return askQuestion(1);
      }

      BINANCE_APIKEY = answer.trim();
      return askQuestion(2);
    });
  } else {
    rl.question('Введите binance secret\n', answer => {
      if (!answer) {
        console.log('Вы ничего не ввели');
        return askQuestion(2);
      }

      BINANCE_SECRET = answer.trim();
      setLeverageForAllInstruments(USER_LEVERAGE);
    });
  }
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


askQuestion(0);
