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

import { Injector } from '@angular/core';
import { CoreSitesProvider } from '@providers/sites';
import { CoreCourseProvider } from '@core/course/providers/course';
import { CoreEventsProvider } from '@providers/events';
import { Network } from '@ionic-native/network';
import { CoreAppProvider } from '@providers/app';
import { CoreCourseModuleMainResourceComponent } from './main-resource-component';

/**
 * Template class to easily create CoreCourseModuleMainComponent of activities.
 */
export class CoreCourseModuleMainActivityComponent extends CoreCourseModuleMainResourceComponent {
    moduleName: string; // Raw module name to be translated. It will be translated on init.

    // Data for context menu.
    syncIcon: string; // Sync icon.
    hasOffline: boolean; // If it has offline data to be synced.
    isOnline: boolean; // If the app is online or not.

    protected siteId: string; // Current Site ID.
    protected syncObserver: any; // It will observe the sync auto event.
    protected onlineObserver: any; // It will observe the status of the network connection.
    protected syncEventName: string; // Auto sync event name.

    // List of services that will be injected using injector.
    // It's done like this so subclasses don't have to send all the services to the parent in the constructor.
    protected sitesProvider: CoreSitesProvider;
    protected courseProvider: CoreCourseProvider;
    protected appProvider: CoreAppProvider;
    protected eventsProvider: CoreEventsProvider;

    constructor(injector: Injector) {
        super(injector);

        this.sitesProvider = injector.get(CoreSitesProvider);
        this.courseProvider = injector.get(CoreCourseProvider);
        this.appProvider = injector.get(CoreAppProvider);
        this.eventsProvider = injector.get(CoreEventsProvider);

        const network = injector.get(Network);

        // Refresh online status when changes.
        this.onlineObserver = network.onchange().subscribe((online) => {
            this.isOnline = this.appProvider.isOnline();
        });
    }

    /**
     * Component being initialized.
     */
    ngOnInit(): void {
        super.ngOnInit();

        this.hasOffline = false;
        this.syncIcon = 'spinner';
        this.siteId = this.sitesProvider.getCurrentSiteId();
        this.moduleName = this.courseProvider.translateModuleName(this.moduleName);

        if (this.syncEventName) {
            // Refresh data if this discussion is synchronized automatically.
            this.syncObserver = this.eventsProvider.on(this.syncEventName, (data) => {
                if (this.isRefreshSyncNeeded(data)) {
                    // Refresh the data.
                    this.refreshContent(false);
                }
            }, this.siteId);
        }
    }

    /**
     * Refresh the data.
     *
     * @param {any}       [refresher] Refresher.
     * @param {Function}  [done] Function to call when done.
     * @param {boolean}   [showErrors=false] If show errors to the user of hide them.
     * @return {Promise<any>} Promise resolved when done.
     */
    doRefresh(refresher?: any, done?: () => void, showErrors: boolean = false): Promise<any> {
        if (this.loaded) {
            this.refreshIcon = 'spinner';
            this.syncIcon = 'spinner';

            return this.refreshContent(true, showErrors).finally(() => {
                this.refreshIcon = 'refresh';
                this.syncIcon = 'sync';
                refresher && refresher.complete();
                done && done();
            });
        }

        return Promise.resolve();
    }

    /**
     * Compares sync event data with current data to check if refresh content is needed.
     *
     * @param {any} syncEventData Data received on sync observer.
     * @return {boolean}          True if refresh is needed, false otherwise.
     */
    protected isRefreshSyncNeeded(syncEventData: any): boolean {
        return false;
    }

    /**
     * Perform the refresh content function.
     *
     * @param  {boolean}      [sync=false]       If the refresh needs syncing.
     * @param  {boolean}      [showErrors=false] Wether to show errors to the user or hide them.
     * @return {Promise<any>} Resolved when done.
     */
    protected refreshContent(sync: boolean = false, showErrors: boolean = false): Promise<any> {
        return this.invalidateContent().catch(() => {
            // Ignore errors.
        }).then(() => {
            return this.loadContent(true, sync, showErrors);
        });
    }

    /**
     * Download the component contents.
     *
     * @param {boolean}       [refresh=false] Whether we're refreshing data.
     * @param  {boolean}      [sync=false]       If the refresh needs syncing.
     * @param  {boolean}      [showErrors=false] Wether to show errors to the user or hide them.
     * @return {Promise<any>} Promise resolved when done.
     */
    protected fetchContent(refresh: boolean = false, sync: boolean = false, showErrors: boolean = false): Promise<any> {
        return Promise.resolve();
    }

    /**
     * Loads the component contents and shows the corresponding error.
     *
     * @param {boolean}       [refresh=false] Whether we're refreshing data.
     * @param  {boolean}      [sync=false]       If the refresh needs syncing.
     * @param  {boolean}      [showErrors=false] Wether to show errors to the user or hide them.
     * @return {Promise<any>} Promise resolved when done.
     */
    protected loadContent(refresh?: boolean, sync: boolean = false, showErrors: boolean = false): Promise<any> {
        this.isOnline = this.appProvider.isOnline();

        return this.fetchContent(refresh, sync, showErrors).catch((error) => {
            if (!refresh) {
                // Some call failed, retry without using cache since it might be a new activity.
                return this.refreshContent(sync);
            }

            // Error getting data, fail.
            this.domUtils.showErrorModalDefault(error, this.fetchContentDefaultError, true);
        }).finally(() => {
            this.loaded = true;
            this.refreshIcon = 'refresh';
            this.syncIcon = 'sync';
        });
    }

    /**
     * Performs the sync of the activity.
     *
     * @return {Promise<any>} Promise resolved when done.
     */
    protected sync(): Promise<any> {
        return Promise.resolve(true);
    }

    /**
     * Checks if sync has succeed from result sync data.
     *
     * @param  {any}     result Data returned on the sync function.
     * @return {boolean}        If suceed or not.
     */
    protected hasSyncSucceed(result: any): boolean {
        return true;
    }

    /**
     * Tries to synchronize the activity.
     *
     * @param  {boolean}      [showErrors=false] If show errors to the user of hide them.
     * @return {Promise<boolean>} Promise resolved with true if sync succeed, or false if failed.
     */
    protected syncActivity(showErrors: boolean = false): Promise<boolean> {
        return this.sync().then((result) => {
            if (result.warnings && result.warnings.length) {
                this.domUtils.showErrorModal(result.warnings[0]);
            }

            return this.hasSyncSucceed(result);
        }).catch((error) => {
            if (showErrors) {
                this.domUtils.showErrorModalDefault(error, 'core.errorsync', true);
            }

            return false;
        });
    }

    /**
     * Component being destroyed.
     */
    ngOnDestroy(): void {
        super.ngOnDestroy();

        this.onlineObserver && this.onlineObserver.unsubscribe();
        this.syncObserver && this.syncObserver.off();
    }
}
