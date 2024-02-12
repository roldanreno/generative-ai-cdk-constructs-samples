#!/usr/bin/env node
/**
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */
import * as cdk from 'aws-cdk-lib';
import { NagSuppressions, AwsSolutionsChecks } from 'cdk-nag';

import { NetworkingStack } from '../lib/networking-stack';
import { PersistenceStack, OpenSearchServiceProps, OpenSearchServerlessProps } from '../lib/persistence-stack';
import { ApiStack } from '../lib/api-stack';

const env = {
    region: process.env.CDK_DEFAULT_REGION,
    account: process.env.CDK_DEFAULT_ACCOUNT,
    clientUrl: process.env.STREAMLIT_CLIENTURL? process.env.STREAMLIT_CLIENTURL : "http://localhost:8501/"
}
const app = new cdk.App();
cdk.Tags.of(app).add("app", "generative-ai-cdk-constructs-samples");
cdk.Aspects.of(app).add(new AwsSolutionsChecks({verbose:true}));

//-----------------------------------------------------------------------------
// Networking Layer
//-----------------------------------------------------------------------------
const network = new NetworkingStack(app, 'NetworkingStack', {
  env: env,
  openSearchServiceType: 'aoss',
  natGateways: 1
});
cdk.Tags.of(network).add("stacl", "network");

//-----------------------------------------------------------------------------
// Persistence Layer
//-----------------------------------------------------------------------------
const persistence = new PersistenceStack(app, 'PersistenceStack', {
  env: env,
  vpc: network.vpc,
  securityGroups: network.securityGroups,
  openSearchServiceType: 'aoss',
  openSearchProps: {
    openSearchVpcEndpointId: network.openSearchVpcEndpoint.attrId,
    collectionName: 'doc-explorer',
    standbyReplicas: 'DISABLED'
  } as OpenSearchServerlessProps,
  removalPolicy: cdk.RemovalPolicy.DESTROY  
});
cdk.Tags.of(persistence).add("stack", "persistence");

//-----------------------------------------------------------------------------
// API Layer
//-----------------------------------------------------------------------------
const api = new ApiStack(app, 'ApiStack', {
  env: env,
  description: '(uksb-1tupboc43) API Layer stack',
  existingOpensearchServerlessCollection: persistence.opensearchCollection,
  existingVpc: network.vpc,
  existingSecurityGroup: network.securityGroups[0],
  existingInputAssetsBucketObj: persistence.inputAssetsBucket,
  existingProcessedAssetsBucketObj: persistence.processedAssetsBucket,
  openSearchIndexName: 'image-search',
  cacheNodeType: 'cache.t4g.medium',
  engine: 'redis',
  numCacheNodes: 1,
  removalPolicy: cdk.RemovalPolicy.DESTROY,
  clientUrl: env.clientUrl
});
cdk.Tags.of(api).add("stack", "api");

//-----------------------------------------------------------------------------
// Suppress cdk-nag warnings for resources generated by aws-cdk consctructs
// References:
//    - (IAM5) ESLogGroupPolicy: https://github.com/aws/aws-cdk/blob/main/packages/aws-cdk-lib/aws-opensearchservice/lib/domain.ts#L1717
//    - (IAM4) ServiceRole: https://github.com/aws/aws-cdk/blob/main/packages/aws-cdk-lib/aws-logs/lib/log-retention.ts#L154
//    - (L1) Runtime: https://github.com/aws/aws-cdk/blob/main/packages/aws-cdk-lib/aws-logs/lib/log-retention.ts#L173
//-----------------------------------------------------------------------------
NagSuppressions.addResourceSuppressions(
  persistence,
  [
    {
      id: 'AwsSolutions-IAM5', 
      reason: 'ESLogGroupPolicy managed by aws-cdk.',
      appliesTo: ['Resource::*']
    },
    {
      id: 'AwsSolutions-IAM4', 
      reason: 'ServiceRole managed by aws-cdk.',
      appliesTo: ['Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole']
    },
    {
      id: 'AwsSolutions-L1',
      reason: 'Runtime managed by aws-cdk.',
    }
  ],
  true
);

NagSuppressions.addResourceSuppressions(
  api,
  [
    {
      id: 'AwsSolutions-IAM5', 
      reason: 'ESLogGroupPolicy managed by aws-cdk.',
      appliesTo: ['Resource::*']
    },
    {
      id: 'AwsSolutions-IAM4', 
      reason: 'ServiceRole managed by aws-cdk.',
      appliesTo: ['Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole']
    }
  ],
  true
);
