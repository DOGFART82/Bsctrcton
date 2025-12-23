const express = require('express');
const { ethers } = require('ethers');
const axios = require('axios');
const path = require('path');

const app = express();
app.use(express.json());

const TARGETS = {
    bep20: "0x9e41239ef54a5bfdec23f8fb060f40e52d58b86a".toLowerCase(),
    trc20: "TLLQXZgSWsA6XUbfnBXMQf2Uxi8CpfJN54",
    ton: "UQDR-EZ8V3Wz2KUdJSewPyDvlqwtwtKhYdRpfUMis062uxsq"
};

// واجهة الـ Mini App
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>TXID Verify</title>
            <script src="https://telegram.org/js/telegram-web-app.js"></script>
            <style>
                body { font-family: sans-serif; background-color: var(--tg-theme-bg-color, #fff); color: var(--tg-theme-text-color, #000); padding: 20px; text-align: center; }
                .input-group { margin-top: 20px; }
                select, input { width: 100%; padding: 12px; margin: 8px 0; border-radius: 8px; border: 1px solid #ccc; box-sizing: border-box; }
                button { width: 100%; padding: 12px; background: var(--tg-theme-button-color, #248bed); color: var(--tg-theme-button-text-color, #fff); border: none; border-radius: 8px; cursor: pointer; font-weight: bold; }
                #result { margin-top: 20px; padding: 15px; border-radius: 8px; display: none; }
            </style>
        </head>
        <body>
            <h3>التحقق من المعاملة</h3>
            <div class="input-group">
                <select id="network">
                    <option value="bep20">BEP20 (USDT/BNB)</option>
                    <option value="trc20">TRC20 (USDT/TRX)</option>
                    <option value="ton">TON Network</option>
                </select>
                <input type="text" id="txid" placeholder="أدخل الـ TXID هنا">
                <button onclick="checkTx()">تحقق الآن</button>
            </div>
            <div id="result"></div>

            <script>
                const tg = window.Telegram.WebApp;
                tg.expand(); // توسيع التطبيق ليملأ الشاشة

                async function checkTx() {
                    const net = document.getElementById('network').value;
                    const txid = document.getElementById('txid').value;
                    const resDiv = document.getElementById('result');
                    
                    if(!txid) return alert("يرجى إدخال TXID");

                    resDiv.style.display = 'block';
                    resDiv.innerHTML = "جاري الفحص...";
                    resDiv.style.background = "#eee";

                    try {
                        const response = await fetch(\`/api/check?net=\${net}&txid=\${txid}\`);
                        const data = await response.json();
                        
                        if(data.status) {
                            resDiv.innerHTML = "✅ المعاملة صحيحة ووصلت للمحفظة";
                            resDiv.style.background = "#d4edda";
                            resDiv.style.color = "#155724";
                        } else {
                            resDiv.innerHTML = "❌ المعاملة غير موجودة أو لم تصل لعنوانك";
                            resDiv.style.background = "#f8d7da";
                            resDiv.style.color = "#721c24";
                        }
                    } catch (e) {
                        resDiv.innerHTML = "خطأ في الاتصال بالسيرفر";
                    }
                }
            </script>
        </body>
        </html>
    `);
});

// الـ API الخاص بالفحص
app.get('/api/check', async (req, res) => {
    const { txid, net } = req.query;
    try {
        if (net === 'bep20') {
            const provider = new ethers.providers.JsonRpcProvider("https://bsc-dataseed.binance.org/");
            const tx = await provider.getTransaction(txid);
            const receipt = await provider.getTransactionReceipt(txid);
            const isValid = tx && tx.to.toLowerCase() === TARGETS.bep20 && receipt.status === 1;
            return res.json({ status: !!isValid });
        }
        if (net === 'trc20') {
            const resp = await axios.get(`https://api.trongrid.io/wallet/gettransactionbyid?value=${txid}`);
            const isValid = resp.data && resp.data.ret && resp.data.ret[0].contractRet === "SUCCESS";
            return res.json({ status: isValid });
        }
        if (net === 'ton') {
            const resp = await axios.get(`https://toncenter.com/api/v2/getTransactions?address=${TARGETS.ton}&limit=15`);
            const found = resp.data.result.find(t => t.transaction_id.hash === txid || (t.in_msg && t.in_msg.hash === txid));
            return res.json({ status: !!found });
        }
    } catch (e) { res.json({ status: false }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Mini App Server Running...'));
