const razorpay = require("../utils/razorpay");
const crypto = require("crypto");



// CREATE RAZORPAY ORDER

exports.createPaymentOrder = async(req,res)=>{

    try{


        const {
            amount
        } = req.body;



        const options = {

            amount:
            Math.round(amount * 100),

            currency:"INR",

            receipt:
            "receipt_"+Date.now(),

        };



        const order =
        await razorpay.orders.create(options);



        res.status(200).json({

            success:true,

            order

        });



    }
    catch(error){

        console.log(
            "Razorpay create error",
            error
        );


        res.status(500).json({

            success:false,

            message:
            "Payment order creation failed"

        });

    }

};





// VERIFY PAYMENT


exports.verifyPayment = async(req,res)=>{


try{


const {

razorpay_order_id,

razorpay_payment_id,

razorpay_signature


}=req.body;



const body =
razorpay_order_id
+
"|"
+
razorpay_payment_id;



const expectedSignature =
crypto
.createHmac(
"sha256",
process.env.RAZORPAY_KEY_SECRET
)
.update(body.toString())
.digest("hex");




if(expectedSignature === razorpay_signature){


return res.status(200).json({

success:true,

message:
"Payment verified"

});


}



res.status(400).json({

success:false,

message:
"Invalid payment"

});



}
catch(error){


console.log(error);


res.status(500).json({

success:false,

message:
"Verification failed"

});


}



};