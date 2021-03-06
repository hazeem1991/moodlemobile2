// (C) Copyright 2015 Martin Dougiamas
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { Component, Input, Injector } from '@angular/core';
import { CoreAppProvider } from '@providers/app';
import { CoreCourseProvider } from '@core/course/providers/course';
import { CoreCourseModuleMainResourceComponent } from '@core/course/classes/main-resource-component';
import { AddonModFolderProvider } from '../../providers/folder';
import { AddonModFolderHelperProvider } from '../../providers/helper';

/**
 * Component that displays a folder.
 * @todo Adding a new file in a folder updates the revision of all the files, so they're all shown as outdated.
 *       To ignore revision in folders we'll have to modify CoreCourseModulePrefetchDelegate, core-file and CoreFilepoolProvider.
 */
@Component({
    selector: 'addon-mod-folder-index',
    templateUrl: 'index.html',
})
export class AddonModFolderIndexComponent extends CoreCourseModuleMainResourceComponent {
    @Input() path: string; // For subfolders. Use the path instead of a boolean so Angular detects them as different states.

    component = AddonModFolderProvider.COMPONENT;
    canGetFolder: boolean;
    contents: any;

    constructor(injector: Injector, private folderProvider: AddonModFolderProvider, private courseProvider: CoreCourseProvider,
            private appProvider: CoreAppProvider, private folderHelper: AddonModFolderHelperProvider) {
        super(injector);
    }

    /**
     * Component being initialized.
     */
    ngOnInit(): void {
        super.ngOnInit();

        this.canGetFolder = this.folderProvider.isGetFolderWSAvailable();

        if (this.path) {
            // Subfolder. Use module param.
            this.showModuleData(this.module);
            this.loaded = true;
            this.refreshIcon = 'refresh';
        } else {
            this.loadContent().then(() => {
                this.folderProvider.logView(this.module.instance).then(() => {
                    this.courseProvider.checkModuleCompletion(this.courseId, this.module.completionstatus);
                });
            }).finally(() => {
                this.loaded = true;
                this.refreshIcon = 'refresh';
            });
        }
    }

    /**
     * Perform the invalidate content function.
     *
     * @return {Promise<any>} Resolved when done.
     */
    protected invalidateContent(): Promise<any> {
        return this.folderProvider.invalidateContent(this.module.id, this.courseId);
    }

    /**
     * Convenience function to set scope data using module.
     * @param {any} module Module to show.
     */
    protected showModuleData(module: any): void {
        this.description = module.intro || module.description;

        this.dataRetrieved.emit(module);

        if (this.path) {
            // Subfolder.
            this.contents = module.contents;
        } else {
            this.contents = this.folderHelper.formatContents(module.contents);
        }
    }

    /**
     * Download folder contents.
     *
     * @param {boolean} [refresh] Whether we're refreshing data.
     * @return {Promise<any>} Promise resolved when done.
     */
    protected fetchContent(refresh?: boolean): Promise<any> {
        let promise;

        if (this.canGetFolder) {
            promise = this.folderProvider.getFolder(this.courseId, this.module.id).then((folder) => {
                return this.courseProvider.loadModuleContents(this.module, this.courseId).then(() => {
                    folder.contents = this.module.contents;

                    return folder;
                });
            });
        } else {
            promise = this.courseProvider.getModule(this.module.id, this.courseId).then((folder) => {
                if (!folder.contents.length && this.module.contents.length && !this.appProvider.isOnline()) {
                    // The contents might be empty due to a cached data. Use the old ones.
                    folder.contents = this.module.contents;
                }
                this.module = folder;

                return folder;
            });
        }

        return promise.then((folder) => {
            if (folder) {
                this.description = folder.intro || folder.description;
                this.dataRetrieved.emit(folder);
            }

            this.showModuleData(folder);

            // All data obtained, now fill the context menu.
            this.fillContextMenu(refresh);
        });
    }
}
