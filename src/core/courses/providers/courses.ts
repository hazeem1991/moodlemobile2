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

import { Injectable } from '@angular/core';
import { CoreLoggerProvider } from '@providers/logger';
import { CoreSitesProvider } from '@providers/sites';
import { CoreSite } from '@classes/site';

/**
 * Service that provides some features regarding lists of courses and categories.
 */
@Injectable()
export class CoreCoursesProvider {
    static SEARCH_PER_PAGE = 20;
    static ENROL_INVALID_KEY = 'CoreCoursesEnrolInvalidKey';
    static EVENT_MY_COURSES_UPDATED = 'courses_my_courses_updated';
    static EVENT_MY_COURSES_REFRESHED = 'courses_my_courses_refreshed';
    protected ROOT_CACHE_KEY = 'mmCourses:';
    protected logger;

    constructor(logger: CoreLoggerProvider, private sitesProvider: CoreSitesProvider) {
        this.logger = logger.getInstance('CoreCoursesProvider');
    }

    /**
     * Get categories. They can be filtered by id.
     *
     * @param {number} categoryId Category ID to get.
     * @param {boolean} [addSubcategories] If it should add subcategories to the list.
     * @param {string} [siteId] Site to get the courses from. If not defined, use current site.
     * @return {Promise<any[]>} Promise resolved with the categories.
     */
    getCategories(categoryId: number, addSubcategories?: boolean, siteId?: string): Promise<any[]> {
        return this.sitesProvider.getSite(siteId).then((site) => {
            // Get parent when id is the root category.
            const criteriaKey = categoryId == 0 ? 'parent' : 'id',
                data = {
                    criteria: [
                        { key: criteriaKey, value: categoryId }
                    ],
                    addsubcategories: addSubcategories ? 1 : 0
                },
                preSets = {
                    cacheKey: this.getCategoriesCacheKey(categoryId, addSubcategories)
                };

            return site.read('core_course_get_categories', data, preSets);
        });
    }

    /**
     * Get cache key for get categories methods WS call.
     *
     * @param {number} categoryId Category ID to get.
     * @param {boolean} [addSubcategories] If add subcategories to the list.
     * @return {string} Cache key.
     */
    protected getCategoriesCacheKey(categoryId: number, addSubcategories?: boolean): string {
        return this.ROOT_CACHE_KEY + 'categories:' + categoryId + ':' + !!addSubcategories;
    }

    /**
     * Given a list of course IDs to get course admin and nav options, return the list of courseIds to use.
     *
     * @param {number[]} courseIds Course IDs.
     * @param {string} [siteId] Site Id. If not defined, use current site.
     * @return {Promise}            Promise resolved with the list of course IDs.
     */
    protected getCourseIdsForAdminAndNavOptions(courseIds: number[], siteId?: string): Promise<number[]> {
        return this.sitesProvider.getSite(siteId).then((site) => {
            const siteHomeId = site.getSiteHomeId();

            if (courseIds.length == 1) {
                // Only 1 course, check if it belongs to the user courses. If so, use all user courses.
                return this.getUserCourses(true, siteId).then((courses) => {
                    const courseId = courseIds[0];
                    let useAllCourses = false;

                    if (courseId == siteHomeId) {
                        // It's site home, use all courses.
                        useAllCourses = true;
                    } else {
                        for (let i = 0; i < courses.length; i++) {
                            if (courses[i].id == courseId) {
                                useAllCourses = true;
                                break;
                            }
                        }
                    }

                    if (useAllCourses) {
                        // User is enrolled, retrieve all the courses.
                        courseIds = courses.map((course) => {
                            return course.id;
                        });

                        // Always add the site home ID.
                        courseIds.push(siteHomeId);
                    }

                    return courseIds;
                }).catch(() => {
                    // Ignore errors.
                    return courseIds;
                });
            } else {
                return courseIds;
            }
        });
    }

    /**
     * Check if My Courses is disabled in a certain site.
     *
     * @param {string} [siteId] Site Id. If not defined, use current site.
     * @return {Promise<boolean>} Promise resolved with true if disabled, rejected or resolved with false otherwise.
     */
    isMyCoursesDisabled(siteId?: string): Promise<boolean> {
        return this.sitesProvider.getSite(siteId).then((site) => {
            return this.isMyCoursesDisabledInSite(site);
        });
    }

    /**
     * Check if My Courses is disabled in a certain site.
     *
     * @param {CoreSite} [site] Site. If not defined, use current site.
     * @return {boolean} Whether it's disabled.
     */
    isMyCoursesDisabledInSite(site?: CoreSite): boolean {
        site = site || this.sitesProvider.getCurrentSite();

        return site.isFeatureDisabled('$mmSideMenuDelegate_mmCourses');
    }

    /**
     * Check if Search Courses is disabled in a certain site.
     *
     * @param {string} [siteId] Site Id. If not defined, use current site.
     * @return {Promise<boolean>} Promise resolved with true if disabled, rejected or resolved with false otherwise.
     */
    isSearchCoursesDisabled(siteId?: string): Promise<boolean> {
        return this.sitesProvider.getSite(siteId).then((site) => {
            return this.isSearchCoursesDisabledInSite(site);
        });
    }

    /**
     * Check if Search Courses is disabled in a certain site.
     *
     * @param {CoreSite} [site] Site. If not defined, use current site.
     * @return {boolean} Whether it's disabled.
     */
    isSearchCoursesDisabledInSite(site?: CoreSite): boolean {
        site = site || this.sitesProvider.getCurrentSite();

        return site.isFeatureDisabled('$mmCoursesDelegate_search');
    }

    /**
     * Get course.
     *
     * @param {number} id ID of the course to get.
     * @param {string} [siteId] Site to get the courses from. If not defined, use current site.
     * @return {Promise<any>} Promise resolved with the course.
     */
    getCourse(id: number, siteId?: string): Promise<any> {
        return this.getCourses([id], siteId).then((courses) => {
            if (courses && courses.length > 0) {
                return courses[0];
            }

            return Promise.reject(null);
        });
    }

    /**
     * Get the enrolment methods from a course.
     *
     * @param {number} id ID of the course.
     * @param {string} [siteId] Site ID. If not defined, use current site.
     * @return {Promise<any[]} Promise resolved with the methods.
     */
    getCourseEnrolmentMethods(id: number, siteId?: string): Promise<any[]> {
        return this.sitesProvider.getSite(siteId).then((site) => {
            const params = {
                    courseid: id
                },
                preSets = {
                    cacheKey: this.getCourseEnrolmentMethodsCacheKey(id)
                };

            return site.read('core_enrol_get_course_enrolment_methods', params, preSets);
        });
    }

    /**
     * Get cache key for get course enrolment methods WS call.
     *
     * @param {number} id Course ID.
     * @return {string} Cache key.
     */
    protected getCourseEnrolmentMethodsCacheKey(id: number): string {
        return this.ROOT_CACHE_KEY + 'enrolmentmethods:' + id;
    }

    /**
     * Get info from a course guest enrolment method.
     *
     * @param {number} instanceId Guest instance ID.
     * @param {string} [siteId] Site ID. If not defined, use current site.
     * @return {Promise<any>} Promise resolved when the info is retrieved.
     */
    getCourseGuestEnrolmentInfo(instanceId: number, siteId?: string): Promise<any> {
        return this.sitesProvider.getSite(siteId).then((site) => {
            const params = {
                    instanceid: instanceId
                },
                preSets = {
                    cacheKey: this.getCourseGuestEnrolmentInfoCacheKey(instanceId)
                };

            return site.read('enrol_guest_get_instance_info', params, preSets).then((response) => {
                return response.instanceinfo;
            });
        });
    }

    /**
     * Get cache key for get course guest enrolment methods WS call.
     *
     * @param {number} instanceId Guest instance ID.
     * @return {string} Cache key.
     */
    protected getCourseGuestEnrolmentInfoCacheKey(instanceId: number): string {
        return this.ROOT_CACHE_KEY + 'guestinfo:' + instanceId;
    }

    /**
     * Get courses.
     * Warning: if the user doesn't have permissions to view some of the courses passed the WS call will fail.
     * The user must be able to view ALL the courses passed.
     *
     * @param {number[]} ids List of IDs of the courses to get.
     * @param {string} [siteId] Site to get the courses from. If not defined, use current site.
     * @return {Promise<any[]>}  Promise resolved with the courses.
     */
    getCourses(ids: number[], siteId?: string): Promise<any[]> {
        if (!Array.isArray(ids)) {
            return Promise.reject(null);
        } else if (ids.length === 0) {
            return Promise.resolve([]);
        }

        return this.sitesProvider.getSite(siteId).then((site) => {
            const data = {
                    options: {
                        ids: ids
                    }
                },
                preSets = {
                    cacheKey: this.getCoursesCacheKey(ids)
                };

            return site.read('core_course_get_courses', data, preSets);
        });
    }

    /**
     * Get cache key for get courses WS call.
     *
     * @param {number[]} ids Courses IDs.
     * @return {string} Cache key.
     */
    protected getCoursesCacheKey(ids: number[]): string {
        return this.ROOT_CACHE_KEY + 'course:' + JSON.stringify(ids);
    }

    /**
     * Get courses. They can be filtered by field.
     *
     * @param {string} [field] The field to search. Can be left empty for all courses or:
     *                             id: course id.
     *                             ids: comma separated course ids.
     *                             shortname: course short name.
     *                             idnumber: course id number.
     *                             category: category id the course belongs to.
     * @param {any} [value] The value to match.
     * @param {string} [siteId] Site ID. If not defined, use current site.
     * @return {Promise<any[]>} Promise resolved with the courses.
     */
    getCoursesByField(field?: string, value?: any, siteId?: string): Promise<any[]> {
        return this.sitesProvider.getSite(siteId).then((site) => {
            const data = {
                    field: field || '',
                    value: field ? value : ''
                },
                preSets = {
                    cacheKey: this.getCoursesByFieldCacheKey(field, value)
                };

            return site.read('core_course_get_courses_by_field', data, preSets).then((courses) => {
                if (courses.courses) {
                    // Courses will be sorted using sortorder if avalaible.
                    return courses.courses.sort((a, b) => {
                        if (typeof a.sortorder == 'undefined' && typeof b.sortorder == 'undefined') {
                            return b.id - a.id;
                        }

                        if (typeof a.sortorder == 'undefined') {
                            return 1;
                        }

                        if (typeof b.sortorder == 'undefined') {
                            return -1;
                        }

                        return a.sortorder - b.sortorder;
                    });
                }

                return Promise.reject(null);
            });
        });
    }

    /**
     * Get cache key for get courses WS call.
     *
     * @param {string} [field] The field to search.
     * @param {any} [value] The value to match.
     * @return {string} Cache key.
     */
    protected getCoursesByFieldCacheKey(field?: string, value?: any): string {
        field = field || '';
        value = field ? value : '';

        return this.ROOT_CACHE_KEY + 'coursesbyfield:' + field + ':' + value;
    }

    /**
     * Check if get courses by field WS is available.
     *
     * @return {boolean} Whether get courses by field is available.
     */
    isGetCoursesByFieldAvailable(): boolean {
        return this.sitesProvider.wsAvailableInCurrentSite('core_course_get_courses_by_field');
    }

    /**
     * Get the navigation and administration options for the given courses.
     *
     * @param {number[]} courseIds IDs of courses to get.
     * @param {string} [siteId] Site ID. If not defined, current site.
     * @return {Promise<{navOptions: any, admOptions: any}>} Promise resolved with the options for each course.
     */
    getCoursesAdminAndNavOptions(courseIds: number[], siteId?: string): Promise<{ navOptions: any, admOptions: any }> {
        siteId = siteId || this.sitesProvider.getCurrentSiteId();

        // Get the list of courseIds to use based on the param.
        return this.getCourseIdsForAdminAndNavOptions(courseIds, siteId).then((courseIds) => {
            const promises = [];
            let navOptions,
                admOptions;

            // Get user navigation and administration options.
            promises.push(this.getUserNavigationOptions(courseIds, siteId).catch(() => {
                // Couldn't get it, return empty options.
                return {};
            }).then((options) => {
                navOptions = options;
            }));

            promises.push(this.getUserAdministrationOptions(courseIds, siteId).catch(() => {
                // Couldn't get it, return empty options.
                return {};
            }).then((options) => {
                admOptions = options;
            }));

            return Promise.all(promises).then(() => {
                return { navOptions: navOptions, admOptions: admOptions };
            });
        });
    }

    /**
     * Get the common part of the cache keys for user administration options WS calls.
     *
     * @return {string} Cache key.
     */
    protected getUserAdministrationOptionsCommonCacheKey(): string {
        return this.ROOT_CACHE_KEY + 'administrationOptions:';
    }

    /**
     * Get cache key for get user administration options WS call.
     *
     * @param {number[]} courseIds IDs of courses to get.
     * @return {string} Cache key.
     */
    protected getUserAdministrationOptionsCacheKey(courseIds: number[]): string {
        return this.getUserAdministrationOptionsCommonCacheKey() + courseIds.join(',');
    }

    /**
     * Get user administration options for a set of courses.
     *
     * @param {number[]} courseIds IDs of courses to get.
     * @param {string} [siteId] Site ID. If not defined, current site.
     * @return {Promise<any>} Promise resolved with administration options for each course.
     */
    getUserAdministrationOptions(courseIds: number[], siteId?: string): Promise<any> {
        return this.sitesProvider.getSite(siteId).then((site) => {
            const params = {
                    courseids: courseIds
                },
                preSets = {
                    cacheKey: this.getUserAdministrationOptionsCacheKey(courseIds)
                };

            return site.read('core_course_get_user_administration_options', params, preSets).then((response) => {
                // Format returned data.
                return this.formatUserAdminOrNavOptions(response.courses);
            });
        });
    }

    /**
     * Get the common part of the cache keys for user navigation options WS calls.
     *
     * @param {number[]} courseIds IDs of courses to get.
     * @return {string} Cache key.
     */
    protected getUserNavigationOptionsCommonCacheKey(): string {
        return this.ROOT_CACHE_KEY + 'navigationOptions:';
    }

    /**
     * Get cache key for get user navigation options WS call.
     *
     * @return {string} Cache key.
     */
    protected getUserNavigationOptionsCacheKey(courseIds: number[]): string {
        return this.getUserNavigationOptionsCommonCacheKey() + courseIds.join(',');
    }

    /**
     * Get user navigation options for a set of courses.
     *
     * @param {number[]} courseIds IDs of courses to get.
     * @param {string} [siteId] Site ID. If not defined, current site.
     * @return {Promise<any>} Promise resolved with navigation options for each course.
     */
    getUserNavigationOptions(courseIds: number[], siteId?: string): Promise<any> {
        return this.sitesProvider.getSite(siteId).then((site) => {
            const params = {
                    courseids: courseIds
                },
                preSets = {
                    cacheKey: this.getUserNavigationOptionsCacheKey(courseIds)
                };

            return site.read('core_course_get_user_navigation_options', params, preSets).then((response) => {
                // Format returned data.
                return this.formatUserAdminOrNavOptions(response.courses);
            });
        });
    }

    /**
     * Format user navigation or administration options.
     *
     * @param {any[]} courses Navigation or administration options for each course.
     * @return {any} Formatted options.
     */
    protected formatUserAdminOrNavOptions(courses: any[]): any {
        const result = {};

        courses.forEach((course) => {
            const options = {};

            if (course.options) {
                course.options.forEach((option) => {
                    options[option.name] = option.available;
                });
            }

            result[course.id] = options;
        });

        return result;
    }

    /**
     * Get a course the user is enrolled in. This function relies on getUserCourses.
     * preferCache=true will try to speed up the response, but the data returned might not be updated.
     *
     * @param {number} id ID of the course to get.
     * @param {boolean} [preferCache] True if shouldn't call WS if data is cached, false otherwise.
     * @param {string} [siteId] Site to get the courses from. If not defined, use current site.
     * @return {Promise<any>} Promise resolved with the course.
     */
    getUserCourse(id: number, preferCache?: boolean, siteId?: string): Promise<any> {
        if (!id) {
            return Promise.reject(null);
        }

        return this.getUserCourses(preferCache, siteId).then((courses) => {
            let course;
            for (const i in courses) {
                if (courses[i].id == id) {
                    course = courses[i];
                    break;
                }
            }

            return course ? course : Promise.reject(null);
        });
    }

    /**
     * Get user courses.
     *
     * @param {boolean} [preferCache] True if shouldn't call WS if data is cached, false otherwise.
     * @param {string} [siteId] Site to get the courses from. If not defined, use current site.
     * @return {Promise<any[]>} Promise resolved with the courses.
     */
    getUserCourses(preferCache?: boolean, siteId?: string): Promise<any[]> {
        return this.sitesProvider.getSite(siteId).then((site) => {

            const userId = site.getUserId(),
                data = {
                    userid: userId
                },
                preSets = {
                    cacheKey: this.getUserCoursesCacheKey(),
                    omitExpires: !!preferCache
                };

            return site.read('core_enrol_get_users_courses', data, preSets);
        });
    }

    /**
     * Get cache key for get user courses WS call.
     *
     * @return {string} Cache key.
     */
    protected getUserCoursesCacheKey(): string {
        return this.ROOT_CACHE_KEY + 'usercourses';
    }

    /**
     * Invalidates get categories WS call.
     *
     * @param {number} categoryId Category ID to get.
     * @param {boolean} [addSubcategories] If it should add subcategories to the list.
     * @param {string} [siteId] Site Id. If not defined, use current site.
     * @return {Promise<any>} Promise resolved when the data is invalidated.
     */
    invalidateCategories(categoryId: number, addSubcategories?: boolean, siteId?: string): Promise<any> {
        return this.sitesProvider.getSite(siteId).then((site) => {
            return site.invalidateWsCacheForKey(this.getCategoriesCacheKey(categoryId, addSubcategories));
        });
    }

    /**
     * Invalidates get course WS call.
     *
     * @param {number} id Course ID.
     * @param {string} [siteId] Site Id. If not defined, use current site.
     * @return {Promise<any>} Promise resolved when the data is invalidated.
     */
    invalidateCourse(id: number, siteId?: string): Promise<any> {
        return this.invalidateCourses([id], siteId);
    }

    /**
     * Invalidates get course enrolment methods WS call.
     *
     * @param {number} id Course ID.
     * @param {string} [siteId] Site Id. If not defined, use current site.
     * @return {Promise<any>} Promise resolved when the data is invalidated.
     */
    invalidateCourseEnrolmentMethods(id: number, siteId?: string): Promise<any> {
        return this.sitesProvider.getSite(siteId).then((site) => {
            return site.invalidateWsCacheForKey(this.getCourseEnrolmentMethodsCacheKey(id));
        });
    }

    /**
     * Invalidates get course guest enrolment info WS call.
     *
     * @param {number} instanceId Guest instance ID.
     * @param {string} [siteId] Site Id. If not defined, use current site.
     * @return {Promise<any>} Promise resolved when the data is invalidated.
     */
    invalidateCourseGuestEnrolmentInfo(instanceId: number, siteId?: string): Promise<any> {
        return this.sitesProvider.getSite(siteId).then((site) => {
            return site.invalidateWsCacheForKey(this.getCourseGuestEnrolmentInfoCacheKey(instanceId));
        });
    }

    /**
     * Invalidates the navigation and administration options for the given courses.
     *
     * @param {number[]} courseIds IDs of courses to get.
     * @param {string} [siteId] Site ID to invalidate. If not defined, use current site.
     * @return {Promise<any>} Promise resolved when the data is invalidated.
     */
    invalidateCoursesAdminAndNavOptions(courseIds: number[], siteId?: string): Promise<any> {
        siteId = siteId || this.sitesProvider.getCurrentSiteId();

        return this.getCourseIdsForAdminAndNavOptions(courseIds, siteId).then((ids) => {
            const promises = [];

            promises.push(this.invalidateUserAdministrationOptionsForCourses(ids, siteId));
            promises.push(this.invalidateUserNavigationOptionsForCourses(ids, siteId));

            return Promise.all(promises);
        });
    }

    /**
     * Invalidates get courses WS call.
     *
     * @param {number[]} ids Courses IDs.
     * @param {string} [siteId] Site Id. If not defined, use current site.
     * @return {Promise<any>} Promise resolved when the data is invalidated.
     */
    invalidateCourses(ids: number[], siteId?: string): Promise<any> {
        return this.sitesProvider.getSite(siteId).then((site) => {
            return site.invalidateWsCacheForKey(this.getCoursesCacheKey(ids));
        });
    }

    /**
     * Invalidates get courses by field WS call.
     *
     * @param {string} [field] See getCoursesByField for info.
     * @param {any} [value] The value to match.
     * @param {string} [siteId] Site Id. If not defined, use current site.
     * @return {Promise<any>} Promise resolved when the data is invalidated.
     */
    invalidateCoursesByField(field?: string, value?: any, siteId?: string): Promise<any> {
        return this.sitesProvider.getSite(siteId).then((site) => {
            return site.invalidateWsCacheForKey(this.getCoursesByFieldCacheKey(field, value));
        });
    }

    /**
     * Invalidates all user administration options.
     *
     * @param {string} [siteId] Site ID to invalidate. If not defined, use current site.
     * @return {Promise<any>} Promise resolved when the data is invalidated.
     */
    invalidateUserAdministrationOptions(siteId?: string): Promise<any> {
        return this.sitesProvider.getSite(siteId).then((site) => {
            return site.invalidateWsCacheForKeyStartingWith(this.getUserAdministrationOptionsCommonCacheKey());
        });
    }

    /**
     * Invalidates user administration options for certain courses.
     *
     * @param {number[]} courseIds IDs of courses.
     * @param {string} [siteId] Site ID to invalidate. If not defined, use current site.
     * @return {Promise<any>} Promise resolved when the data is invalidated.
     */
    invalidateUserAdministrationOptionsForCourses(courseIds: number[], siteId?: string): Promise<any> {
        return this.sitesProvider.getSite(siteId).then((site) => {
            return site.invalidateWsCacheForKey(this.getUserAdministrationOptionsCacheKey(courseIds));
        });
    }

    /**
     * Invalidates get user courses WS call.
     *
     * @param {string} [siteId] Site ID to invalidate. If not defined, use current site.
     * @return {Promise<any>} Promise resolved when the data is invalidated.
     */
    invalidateUserCourses(siteId?: string): Promise<any> {
        return this.sitesProvider.getSite(siteId).then((site) => {
            return site.invalidateWsCacheForKey(this.getUserCoursesCacheKey());
        });
    }

    /**
     * Invalidates all user navigation options.
     *
     * @param {string} [siteId] Site ID to invalidate. If not defined, use current site.
     * @return {Promise<any>} Promise resolved when the data is invalidated.
     */
    invalidateUserNavigationOptions(siteId?: string): Promise<any> {
        return this.sitesProvider.getSite(siteId).then((site) => {
            return site.invalidateWsCacheForKeyStartingWith(this.getUserNavigationOptionsCommonCacheKey());
        });
    }

    /**
     * Invalidates user navigation options for certain courses.
     *
     * @param {number[]} courseIds IDs of courses.
     * @param {string} [siteId] Site ID to invalidate. If not defined, use current site.
     * @return {Promise<any>} Promise resolved when the data is invalidated.
     */
    invalidateUserNavigationOptionsForCourses(courseIds: number[], siteId?: string): Promise<any> {
        return this.sitesProvider.getSite(siteId).then((site) => {
            return site.invalidateWsCacheForKey(this.getUserNavigationOptionsCacheKey(courseIds));
        });
    }

    /**
     * Check if WS to retrieve guest enrolment data is available.
     *
     * @return {boolean} Whether guest WS is available.
     */
    isGuestWSAvailable(): boolean {
        const currentSite = this.sitesProvider.getCurrentSite();

        return currentSite && currentSite.wsAvailable('enrol_guest_get_instance_info');
    }

    /**
     * Search courses.
     *
     * @param {string} text Text to search.
     * @param {number} [page=0] Page to get.
     * @param {number} [perPage] Number of courses per page. Defaults to CoreCoursesProvider.SEARCH_PER_PAGE.
     * @param {string} [siteId] Site ID. If not defined, use current site.
     * @return {Promise<{total: number, courses: any[]}>} Promise resolved with the courses and the total of matches.
     */
    search(text: string, page: number = 0, perPage?: number, siteId?: string): Promise<{ total: number, courses: any[] }> {
        perPage = perPage || CoreCoursesProvider.SEARCH_PER_PAGE;

        return this.sitesProvider.getSite(siteId).then((site) => {
            const params = {
                    criterianame: 'search',
                    criteriavalue: text,
                    page: page,
                    perpage: perPage
                },
                preSets = {
                    getFromCache: false
                };

            return site.read('core_course_search_courses', params, preSets).then((response) => {
                return { total: response.total, courses: response.courses };
            });
        });
    }

    /**
     * Self enrol current user in a certain course.
     *
     * @param {number} courseId Course ID.
     * @param {string} [password] Password to use.
     * @param {number} [instanceId] Enrol instance ID.
     * @param {string} [siteId] Site ID. If not defined, use current site.
     * @return {Promise<any>} Promise resolved if the user is enrolled. If the password is invalid, the promise is rejected
     *                        with an object with code = CoreCoursesProvider.ENROL_INVALID_KEY.
     */
    selfEnrol(courseId: number, password: string = '', instanceId?: number, siteId?: string): Promise<any> {
        return this.sitesProvider.getSite(siteId).then((site) => {

            const params: any = {
                    courseid: courseId,
                    password: password
                };

            if (instanceId) {
                params.instanceid = instanceId;
            }

            return site.write('enrol_self_enrol_user', params).then((response): any => {
                if (response) {
                    if (response.status) {
                        return true;
                    } else if (response.warnings && response.warnings.length) {
                        let message;
                        response.warnings.forEach((warning) => {
                            // Invalid password warnings.
                            if (warning.warningcode == '2' || warning.warningcode == '3' || warning.warningcode == '4') {
                                message = warning.message;
                            }
                        });

                        if (message) {
                            return Promise.reject({ code: CoreCoursesProvider.ENROL_INVALID_KEY, message: message });
                        } else {
                            return Promise.reject(response.warnings[0]);
                        }
                    }
                }

                return Promise.reject(null);
            });
        });
    }
}
