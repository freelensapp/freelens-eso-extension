/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

// One session per API version of the ESO resources (eso-views.ts): 0.15.1, the
// last release that serves only external-secrets.io/v1beta1.

import { describeEsoViews } from "./eso-views";
import { esoReleaseV1beta1 } from "./extension-helpers";

await describeEsoViews(esoReleaseV1beta1);
