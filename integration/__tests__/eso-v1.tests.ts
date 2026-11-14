/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

// One session per API version of the ESO resources (eso-views.ts): the release
// the types of the extension follow, which serves external-secrets.io/v1.

import { describeEsoViews } from "./eso-views";
import { esoReleaseV1 } from "./extension-helpers";

await describeEsoViews(esoReleaseV1);
