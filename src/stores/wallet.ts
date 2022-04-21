import { Delegation } from '@/utility/delations.interface';
import { toastMe } from '@/utility/functions';
import harmony from '@/utility/harmony';
import StakingPrecompiles from '@/assets/StakingPrecompiles.json'
import { ethers, utils } from 'ethers';
import { defineStore } from 'pinia'
import { useGlobalStore } from './global';
import { fromBech32 } from '@harmony-js/crypto'
interface walletStore {
    isSigned: boolean;
    provider: any;
    userAddress: string
    availableBalance: string;
    delegations: Delegation[]
}

export const useWalletStore = defineStore('wallet', {
    state: () => ({
        isSigned: false,
        provider: null,
        userAddress: '',
        availableBalance: '0',
        delegations: [] as Array<Delegation>
    } as walletStore),
    getters: {
        getTotalStaked(): string {
            return utils.formatUnits(this.delegations.reduce((previousValue, currentValue) => { return currentValue.amount + previousValue }, 0).toString(), 18)
        },
        getTotalRewards(): string {
            return utils.formatUnits(this.delegations.reduce((previousValue, currentValue) => { return currentValue.reward + previousValue }, 0).toString(), 18)
        },
        getPendingUndelegated(): string {
            return utils.formatUnits(this.delegations.reduce((previousValue, currentValue) => {
                const amount = currentValue.Undelegations.reduce((prev, curr) => curr.Amount, 0)
                return amount + previousValue
            }, 0).toString(), 18)
        },
        getUsedDelegations(): Delegation[] {
            return this.delegations.filter((delegation: Delegation) => delegation.amount > 0 || delegation.Undelegations.length > 0 || delegation.reward > 0).sort((aV, bV) => {
                if (aV.amount > bV.amount) {
                    return -1
                } else {
                    return 1
                }
            })
        }
    },
    actions: {
        async loadDelegations() {
            if (!this.isSigned) {
                return false
            }
            try {
                this.delegations = []
                const globalStore = useGlobalStore()
                const delegations = await harmony.getDelegations(globalStore.networkId, this.userAddress)
                if (delegations.status !== 200) {
                    throw 'Response failed'
                }
                this.delegations = delegations.data
            } catch (error) {
                toastMe('error', {
                    title: 'Delegations:',
                    msg: `Error loading delegations.${error}`,
                    link: false,
                })
            }
        },
        async loadOneBalance() {
            if (!this.isSigned) {
                return false
            }
            try {
                this.availableBalance = '0'
                const globalStore = useGlobalStore()
                const availableOnes = await harmony.getBalance(globalStore.networkId, this.userAddress)
                this.availableBalance = availableOnes
            } catch (error) {
                toastMe('error', {
                    title: 'Balance:',
                    msg: `Error loading balance.${error}`,
                    link: false,
                })
            }
        },
        async setupWallet() {
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            await provider.send("eth_requestAccounts", []);
            const signer = await provider.getSigner();
            const { chainId } = await provider.getNetwork()
            const chainAccepted = harmony.getHarmonyNetwork(chainId)
            if (!chainAccepted) {
                toastMe('error', {
                    title: 'Wallet:',
                    msg: "We don't support the network you are connected to.",
                    link: false,
                })
                this.disconnect()
                return false
            } else {
                const accounts = await signer.getAddress();
                const globalStore = useGlobalStore()
                globalStore.autoConnect = true;
                if (accounts !== this.userAddress || globalStore.networkId !== chainAccepted.chainId) {
                    toastMe('success', {
                        title: 'Wallet :',
                        msg: `Succesfully connected to : ` + accounts,
                        link: false,
                    })
                    if (globalStore.networkId !== chainAccepted.chainId) {
                        globalStore.changeChainId(chainAccepted.chainId)
                    }
                    this.provider = provider
                    this.userAddress = accounts
                    this.isSigned = true;
                    this.loadOneBalance()
                    this.loadDelegations()
                }
                return true
            }
        },
        disconnect() {
            const globalStore = useGlobalStore()
            globalStore.changeChainId(1666600000)
            globalStore.autoConnect = false;
            this.provider = null
            this.userAddress = ''
            this.isSigned = false;
            this.availableBalance = '0'
            this.delegations = []
            return false
        },
        async connect() {
            if (window.ethereum !== undefined) {
                return await this.setupWallet()
            }
            else if (window.ethereum == undefined) {
                toastMe('warning', {
                    title: 'Wallet :',
                    msg: "It seems you don't have Metamask installed! try switching Wallet Mode",
                    link: false,
                })
                return false
            }
        },
        async undelegate(validatorAddress: string, amount: string) {
            if (!this.isSigned) {
                return false
            }
            const abi = StakingPrecompiles.abi;
            const user = this.userAddress
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            const signer = provider.getSigner();
            const globalStore = useGlobalStore()
            const network = harmony.getHarmonyNetwork(globalStore.networkId)
            if (!network) {
                return false
            }
            const contract = new ethers.Contract(network.delegatorAddress, abi, signer);
            const tx = await contract.Undelegate(user, fromBech32(validatorAddress), ethers.utils.parseUnits(String(amount), 18)).catch((err: any) => {
                let message;
                if (!err.data?.message) {
                    message = err.message
                } else {
                    message = err.data.message
                }
                toastMe('error', {
                    title: 'Error :',
                    msg: message,
                    link: false
                })
                return
            })
            if (tx !== undefined) {
                let explorer = 'https://explorer.harmony.one/#/tx/'
                let transaction = tx.hash

                toastMe('info', {
                    title: 'Transaction Sent',
                    msg: "Undelegation request sent to network. Waiting for confirmation",
                    link: false,
                    href: `${explorer}${transaction}`
                })
                await tx.wait(1)
                toastMe('success', {
                    title: 'Tx Successful',
                    msg: "Explore : " + transaction,
                    link: true,
                    href: `${explorer}${transaction}`
                })
                return true
            }
            return false
        },
    }
})
