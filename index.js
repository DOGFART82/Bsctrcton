const express = require('express');
const { ethers } = require('ethers');
const axios = require('axios');

const app = express();
app.use(express.json());

// الإعدادات الثابتة
const TARGETS = {
    bep20: "0x9e41239ef54a5bfdec23f8fb060f40e52d58b86a".toLowerCase(),
    trc20: "TLLQXZgSWsA6XUbfnBXMQf2Uxi8CpfJN54",
    ton: "UQDR-EZ8V3Wz2KUdJSewPyDvlqwtwtKhYdRpfUMis062uxsq"
};

const USDT_BEP20_CONTRACT = "0x55d398326f99059ff775485246999027b3197955".toLowerCase();

// --- دوال التحقق التقنية ---

async function verifyBEP20(txid) {
    try {
        const provider = new ethers.providers.JsonRpcProvider("https://bsc-dataseed.binance.org/");
        const receipt = await provider.getTransactionReceipt(txid);
        if (!receipt || receipt.status !== 1) return false;

        // فحص السجلات (Logs) للتأكد من وصول USDT لعنوانك
        const foundLog = receipt.logs.find(log => {
            const isUSDT = log.address.toLowerCase() === USDT_BEP20_CONTRACT;
            const isTransferEvent = log.topics[0] === ethers.utils.id("Transfer(address,address,uint256)");
            if (isUSDT && isTransferEvent) {
                const receiver = ethers.utils.defaultAbiCoder.decode(['address'], log.topics[2])[0];
                return receiver.toLowerCase() === TARGETS.bep20;
            }
            return false;
        });
        
        // إذا لم يكن USDT، قد يكون BNB مباشر
        const tx = await provider.getTransaction(txid);
        const isDirectBNB = tx && tx.to && tx.to.toLowerCase() === TARGETS.bep20;

        return !!foundLog || isDirectBNB;
    } catch (e) { return false; }
}

async function verifyTRC20(txid) {
    try {
        const res = await axios.get(`https://api.trongrid.io/wallet/gettransactionbyid?value=${txid}`);
        if (!res.data || !res.data.ret) return false;
        return res.data.ret[0].contractRet === "SUCCESS";
    } catch (e) { return false; }
}

async function verifyTON(txid) {
    try {
        const res = await axios.get(`https://toncenter.com/api/v2/getTransactions?address=${TARGETS.ton}&limit=15`);
        const found = res.data.result.find(t => 
            t.transaction_id.hash === txid || (t.in_msg && t.in_msg.hash === txid)
        );
        return !!found;
    } catch (e) { return false; }
}

// --- الواجهة والمسارات ---

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <script src="https://telegram.org/js/telegram-web-app.js"></script>
            <style>
                body { font-family: -apple-system, sans-serif; background: var(--tg-theme-bg-color, #fff); color: var(--tg-theme-text-color, #000); padding: 20px; }
                input, select, button { width: 100%; padding: 12px; margin: 10px 0; border-radius: 10px; border: 1px solid #ccc; box-sizing: border-box; font-size: 16px; }
                button { background: var(--tg-theme-button-color, #248bed); color: var(--tg-theme-button-text-color, #fff); border: none; font-weight: bold; }
                #status { margin-top: 20px; padding: 15px; border-radius: 10px; text-align: center; display: none; }
            </style>
        </head>
        <body>
            <h3>تحقق من الدفع</h3>
            <select id="net">
                <option value="bep20">BEP20 (USDT/BNB)</option>
                <option value="trc20">TRC20 (USDT/TRX)</option>
                <option value="ton">TON Network</option>
            </select>
            <input type="text" id="txid" placeholder="أدخل معرف المعاملة TXID">
            <button onclick="startVerify()">تأكيد المعاملة</button>
            <div id="status"></div>

            <script>
                const tg = window.Telegram.WebApp;
                tg.expand();

                async function startVerify() {
                    const net = document.getElementById('net').value;
                    const txid = document.getElementById('txid').value;
                    const statusDiv = document.getElementById('status');
                    
                    if(!txid) return alert("أدخل TXID أولاً");
                    
                    statusDiv.style.display = "block";
                    statusDiv.innerHTML = "جاري التحقق من البلوكشين...";
                    statusDiv.style.background = "#eee";

                    const response = await fetch(\`/api/verify?net=\${net}&txid=\${txid}\`);
                    const data = await response.json();

                    if(data.valid) {
                        statusDiv.innerHTML = "✅ تم التأكد! المعاملة صحيحة.";
                        statusDiv.style.background = "#d4edda";
                        tg.MainButton.setText("إغلاق").show().onClick(() => tg.close());
                    } else {
                        statusDiv.innerHTML = "❌ لم نجد المعاملة أو أنها لم تصل لعنواننا.";
                        statusDiv.style.background = "#f8d7da";
                    }
                }
            </script>
        </body>
        </html>
    `);
});

app.get('/api/verify', async (req, res) => {
    const { net, txid } = req.query;
    let isValid = false;

    if (net === 'bep20') isValid = await verifyBEP20(txid);
    else if (net === 'trc20') isValid = await verifyTRC20(txid);
    else if (net === 'ton') isValid = await verifyTON(txid);

    res.json({ valid: isValid });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server Ready'));
