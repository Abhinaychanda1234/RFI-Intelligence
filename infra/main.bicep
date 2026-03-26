@description('App name prefix')
param appName string = 'rfi-genie'

@description('Azure region')
param location string = resourceGroup().location

@description('App Service plan SKU')
@allowed(['B2', 'B3', 'S1', 'S2', 'P1v3'])
param sku string = 'B2'

@secure()
param openAiApiKey string

param useAzureOpenAI bool = false
param azureOpenAiEndpoint string = ''

@secure()
param azureOpenAiKey string = ''

var suffix = uniqueString(resourceGroup().id)
var storageName = '${replace(appName, '-', '')}${take(suffix, 6)}'
var planName = '${appName}-plan'
var webAppName = '${appName}-${take(suffix, 6)}'
var insightsName = '${appName}-insights'

resource plan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: planName
  location: location
  sku: { name: sku }
  kind: 'linux'
  properties: { reserved: true }
}

resource storage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageName
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: { accessTier: 'Hot', allowBlobPublicAccess: false, minimumTlsVersion: 'TLS1_2' }
}

resource blobSvc 'Microsoft.Storage/storageAccounts/blobServices@2023-01-01' = {
  parent: storage
  name: 'default'
}

resource container 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobSvc
  name: 'rfi-documents'
  properties: { publicAccess: 'None' }
}

resource insights 'Microsoft.Insights/components@2020-02-02' = {
  name: insightsName
  location: location
  kind: 'web'
  properties: { Application_Type: 'web', RetentionInDays: 30 }
}

resource web 'Microsoft.Web/sites@2023-01-01' = {
  name: webAppName
  location: location
  kind: 'app,linux'
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      alwaysOn: true
      appSettings: [
        { name: 'NODE_ENV', value: 'production' }
        { name: 'PORT', value: '8080' }
        { name: 'WEBSITE_NODE_DEFAULT_VERSION', value: '~20' }
        { name: 'SCM_DO_BUILD_DURING_DEPLOYMENT', value: 'true' }
        { name: 'OPENAI_API_KEY', value: openAiApiKey }
        { name: 'USE_AZURE_OPENAI', value: string(useAzureOpenAI) }
        { name: 'AZURE_OPENAI_ENDPOINT', value: azureOpenAiEndpoint }
        { name: 'AZURE_OPENAI_API_KEY', value: azureOpenAiKey }
        { name: 'AZURE_OPENAI_DEPLOYMENT', value: 'gpt-4o' }
        { name: 'AZURE_STORAGE_CONNECTION_STRING', value: 'DefaultEndpointsProtocol=https;AccountName=${storage.name};AccountKey=${storage.listKeys().keys[0].value};EndpointSuffix=core.windows.net' }
        { name: 'USE_AZURE_STORAGE', value: 'true' }
        { name: 'DB_PATH', value: '/home/data/rfi_genie.db' }
        { name: 'APPINSIGHTS_INSTRUMENTATIONKEY', value: insights.properties.InstrumentationKey }
        { name: 'FRONTEND_URL', value: 'https://green-mud-0941f4810.4.azurestaticapps.net' }
      ]
      appCommandLine: 'node backend/dist/server.js'
    }
  }
}

output webAppUrl string = 'https://${web.properties.defaultHostName}'
output webAppName string = web.name
output storageAccount string = storage.name
