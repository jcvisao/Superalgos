function newGovernanceFunctionLibraryUserReferrals() {
    let thisObject = {
        calculate: calculate
    }

    return thisObject

    function calculate(
        pools,
        userProfiles
    ) {
        /*
        Here we will store the total amount of tokens that is going to be distributed among all participants
        of the Referral Program. This will come from a Pool that is configured wiht a codeName config property
        with the value "Referral-Program"
        */
        let referralProgramPoolTokenReward
        /*
        In order to be able to calculate the share of the Referrals Program Pool for each User Profile,
        we need to accumulate all the Icomming Referral Power that each User Profile at their Referral Program
        node has, because with that Incoming Power is that each Referral Program node gets a share of 
        the pool.
         */
        let accumulatedIncomingReferralPower = 0

        /* Scan Pools Until finding the User-Referrlas Pool */
        for (let i = 0; i < pools.length; i++) {
            let poolsNode = pools[i]
            findPool(poolsNode)
        }
        if (referralProgramPoolTokenReward === undefined || referralProgramPoolTokenReward === 0) { return }
        /*
        We will first reset all the referral outgoingPower, and then distribute it.
        */
        for (let i = 0; i < userProfiles.length; i++) {
            let userProfile = userProfiles[i]

            if (userProfile.tokenSwitch === undefined) { continue }
            if (userProfile.tokenSwitch.referralProgram === undefined) { continue }
            if (userProfile.tokenSwitch.referralProgram.payload === undefined) { continue }

            resetUserReferrals(userProfile.tokenSwitch.referralProgram)
        }
        for (let i = 0; i < userProfiles.length; i++) {
            let userProfile = userProfiles[i]

            if (userProfile.tokenSwitch === undefined) { continue }
            if (userProfile.tokenSwitch.referralProgram === undefined) { continue }
            if (userProfile.tokenSwitch.referralProgram.payload === undefined) { continue }

            distributeForReferralProgram(userProfile.tokenSwitch.referralProgram)
        }
        for (let i = 0; i < userProfiles.length; i++) {
            let userProfile = userProfiles[i]

            if (userProfile.tokenSwitch === undefined) { continue }
            if (userProfile.tokenSwitch.referralProgram === undefined) { continue }
            if (userProfile.tokenSwitch.referralProgram.payload === undefined) { continue }

            calculateForReferralProgram(userProfile.tokenSwitch.referralProgram)
        }

        function findPool(node) {
            if (node === undefined) { return }
            if (node.payload === undefined) { return }

            /*
            When we reach certain node types, we will halt the distribution, because these are targets for 
            voting outgoingPower.
            */
            if (
                node.type === 'Pool'
            ) {
                let codeName = UI.projects.foundations.utilities.nodeConfig.loadConfigProperty(node.payload, 'codeName')
                if (codeName === "Referral-Program") {
                    referralProgramPoolTokenReward = node.payload.tokens
                    return
                }
            }
            let schemaDocument = getSchemaDocument(node)
            if (schemaDocument === undefined) { return }

            if (schemaDocument.childrenNodesProperties !== undefined) {
                for (let i = 0; i < schemaDocument.childrenNodesProperties.length; i++) {
                    let property = schemaDocument.childrenNodesProperties[i]

                    switch (property.type) {
                        case 'node': {
                            let childNode = node[property.name]
                            findPool(childNode)
                        }
                            break
                        case 'array': {
                            let propertyArray = node[property.name]
                            if (propertyArray !== undefined) {
                                for (let m = 0; m < propertyArray.length; m++) {
                                    let childNode = propertyArray[m]
                                    findPool(childNode)
                                }
                            }
                            break
                        }
                    }
                }
            }
        }

        function resetUserReferrals(node) {
            if (node === undefined) { return }
            if (node.payload === undefined) { return }
            node.payload.referrals = {
                count: 0,
                outgoingPower: 0,
                ownPower: 0,
                incomingPower: 0,
                awarded: {
                    tokens: 0,
                    percentage: 0
                }
            }
            /*
            If the node is a User Profile, we will check if it has a User Referrer child defined.
            */
            if (
                node.type === 'User Profile' &&
                node.tokenSwitch !== undefined &&
                node.tokenSwitch.referralProgram !== undefined
            ) {
                resetUserReferrals(node.tokenSwitch.referralProgram)
                return
            }
            /*
            If the node is a Referral Program, we will check if it has a User Referrer child defined.
            */
            if (
                node.type === 'Referral Program' &&
                node.userReferrer !== undefined
            ) {
                resetUserReferrals(node.userReferrer)
                return
            }
            /*
            If there is a reference parent defined, this means that the referral outgoingPower is 
            transfered to it.
            */
            if (
                node.type === 'User Referrer' &&
                node.payload.referenceParent !== undefined
            ) {
                resetUserReferrals(node.payload.referenceParent)
                return
            }
        }

        function distributeForReferralProgram(referralProgram) {
            if (referralProgram === undefined || referralProgram.payload === undefined) { return }
            /*
            Here we will convert Token Power into Referral Power. 
            As per system rules referringPower = tokensPower
            */
            let referringPower = referralProgram.payload.tokenPower
            /*
            We will also reseet the count of referrals here.
            */
            let count = 0
            /*
            The Own Power is the power generated by the same User Profile tokens, not inherited from others.
            */
            referralProgram.payload.referrals.ownPower = referringPower

            distributeReferralPower(referralProgram, referringPower, count)
        }

        function distributeReferralPower(
            node,
            referringPower,
            count
        ) {

            if (node === undefined) { return }
            if (node.payload === undefined) { return }

            switch (node.type) {
                case 'Referral Program': {
                    /*
                    This is the point where we increase to our local count of referrals whatever it comes
                    at the count parameters. If we are processing the User Profile of this Referral Program
                    then we will add zero, otherwise, 1.
                    */
                    node.payload.referrals.count = node.payload.referrals.count + count
                    /*
                    The outgoingPower of this node will be accumulating all the referringPower flowing
                    through it, no matter from where it comes. 
                    */
                    node.payload.referrals.outgoingPower = node.payload.referrals.outgoingPower + referringPower
                    /*
                    We need to adjust the balance that holds the accumulationt of all incomingPower of all Referral Program
                    nodes. To do this we will substratct the current incomingPower, bacause it is going to be recalculated
                    inmediatelly after this, and then we will add it again after the recalcualtion.
                    */
                    accumulatedIncomingReferralPower = accumulatedIncomingReferralPower - node.payload.referrals.incomingPower
                    /*
                    At any point in time, the incomingPower will be equal to the total of the outgoingPower minus
                    the ownPower. This is like this because the outgoingPower is the accumulation of all the 
                    power flow that is leaving this node, which includes the ownPower. That means that if we 
                    substract the ownPower, we will have the accumulation of all the incomingPower, which 
                    means all the power coming from other User Profiles referencing this one.
                    */
                    node.payload.referrals.incomingPower = node.payload.referrals.outgoingPower - node.payload.referrals.ownPower
                    /*
                    Now that we have the incomingPower calculated again, we can add it again to the balance of all the incomingPower
                    of all Referral Program nodes.
                    */
                    accumulatedIncomingReferralPower = accumulatedIncomingReferralPower + node.payload.referrals.incomingPower

                    if (node.userReferrer !== undefined) {
                        distributeReferralPower(node.userReferrer, referringPower, 0)
                    }
                    break
                }
                case 'User Referrer': {
                    drawUserReferrer(node)
                    if (node.payload.referenceParent !== undefined) {
                        distributeReferralPower(node.payload.referenceParent, referringPower / 10, 0)
                    }
                    break
                }
                case 'User Profile': {
                    if (node.tokenSwitch !== undefined) {
                        distributeReferralPower(node.tokenSwitch, referringPower, 0)
                    }
                    break
                }
                case 'Token Switch': {
                    if (node.referralProgram !== undefined) {
                        distributeReferralPower(node.referralProgram, referringPower, 1)
                    }
                    break
                }
            }
        }

        function calculateForReferralProgram(referralProgram) {
            /*
            Here we will calculate which share of the Referral Program Pool this user will get in tokens.
            To do that, we use the incomingPower, to se which proportion of the accumulatedIncomingReferralPower
            represents.
            */
            if (referralProgram.payload === undefined) { return }
            /*
            If the accumulatedIncomingReferralPower is not grater the amount of tokens at the Referral Program Pool, then
            this user will get the exact amount of tokens from the pool as incomingPower he has. 

            If the accumulatedIncomingReferralPower is  grater the amount of tokens at the Referral Program Pool, then
            the amount ot tokens to be received is a proportional to the share of incomingPower in accumulatedIncomingReferralPower.
            */
            let totalPowerRewardRatio = accumulatedIncomingReferralPower / referralProgramPoolTokenReward
            if (totalPowerRewardRatio < 1) { totalPowerRewardRatio = 1 }

            if (referralProgram.tokensAwarded === undefined || referralProgram.tokensAwarded.payload === undefined) {
                referralProgram.payload.uiObject.setErrorMessage("Tokens Awarded Node is needed in order for this Program to get Tokens from the Referral Program Pool.")
                return
            }
            referralProgram.payload.referrals.awarded.tokens = referralProgram.payload.referrals.incomingPower * totalPowerRewardRatio
            /*
            As per the system rules, the Referral Program will not give tokens to users that do not ha their own Referrer set up,
            unless it has a big amount of tokens (this last condition is for the edge case where a user it at the top of the 
            referral pyramid.)        
            */
            if (
                referralProgram.payload.referrals.ownPower < 1000000 &&
                (referralProgram.userReferrer === undefined || referralProgram.userReferrer.payload.referenceParent === undefined)
            ) {

                referralProgram.payload.uiObject.setErrorMessage("In order to be awarded " + referralProgram.payload.referrals.awarded.tokens + " SA Tokens from your referrals, you need first to define yourself who your referrer is.")
                referralProgram.payload.referrals.awarded.tokens = 0
            }

            drawReferralProgram(referralProgram)
        }

        function drawUserReferrer(node) {
            if (node.payload !== undefined) {
                const ownPowerText = new Intl.NumberFormat().format(node.payload.parentNode.payload.referrals.ownPower)
                const incomingPowerText = new Intl.NumberFormat().format(node.payload.parentNode.payload.referrals.incomingPower)
                const outgoingPowerText = new Intl.NumberFormat().format(node.payload.parentNode.payload.referrals.outgoingPower)

                node.payload.uiObject.valueAngleOffset = 180
                node.payload.uiObject.valueAtAngle = true

                node.payload.uiObject.setValue(outgoingPowerText + ' ' + 'Referring Power')

                node.payload.uiObject.statusAngleOffset = 0
                node.payload.uiObject.statusAtAngle = false

                node.payload.uiObject.setStatus(ownPowerText + ' Own RP + ' + incomingPowerText + ' Incoming RP = ' + outgoingPowerText + ' ' + ' Outgoing RP')
            }
        }

        function drawReferralProgram(node) {
            if (node.payload !== undefined) {

                node.payload.uiObject.statusAngleOffset = 0
                node.payload.uiObject.statusAtAngle = false

                node.payload.uiObject.setStatus("Referring Power = Token Power")
            }
            if (node.tokensAwarded !== undefined && node.tokensAwarded.payload !== undefined) {

                const tokensAwardedText = new Intl.NumberFormat().format(node.payload.referrals.awarded.tokens)

                node.tokensAwarded.payload.uiObject.statusAngleOffset = 0
                node.tokensAwarded.payload.uiObject.statusAtAngle = false

                node.tokensAwarded.payload.uiObject.setValue(tokensAwardedText + ' SA Tokens')
            }
        }
    }
}