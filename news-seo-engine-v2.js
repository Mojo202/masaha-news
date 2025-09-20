document.addEventListener('DOMContentLoaded', function() {
        var bloggerBlogIdMeta = document.querySelector('meta[name="blogId"]');
        var bloggerApiKeyMeta = document.querySelector('meta[name="apiKey"]');
        var siteUrlMeta = document.querySelector('meta[name="url"]');
        var siteNameMeta = document.querySelector('meta[name="site-name"]');


        var BLOGGER_API_CONFIG = {
            blogId: bloggerBlogIdMeta ? bloggerBlogIdMeta.content : null,
            apiKey: bloggerApiKeyMeta ? bloggerApiKeyMeta.content : null,
            homeUrl: siteUrlMeta ? siteUrlMeta.content : window.location.origin,
            homeName: siteNameMeta ? siteNameMeta.content : "إسم الموقع"
        };


        var blogName = BLOGGER_API_CONFIG.homeName;
        var siteUrl = BLOGGER_API_CONFIG.homeUrl;


        var isStaticPage = window.location.href.includes('/p/');
        var isPostPage = false;
        if (window.location.pathname.endsWith('.html')) {
            if (!isStaticPage) {
                isPostPage = true;
            }
        }


        function applyColors() {
            var root = document.documentElement;
            root.style.setProperty('--blogcolor', getMetaContent('blogcolor', '#000'));
            root.style.setProperty('--softcolor', getMetaContent('softcolor', '#fff'));
            root.style.setProperty('--solidcolor', getMetaContent('solidcolor', '#999'));
        }


        function convertToISO8601(dateString) {
            if (dateString === null) return null;
            if (dateString === 'غير معروف') return null;
            try {
                var date = new Date(dateString);
                var offset = 2 * 60 * 60 * 1000;
                var adjusted = new Date(date.getTime() + offset);
                return adjusted.toISOString().replace(/\.000Z$/, '+02:00');
            } catch (e) {
                return null;
            }
        }


        function getPublishedDate() {
            var publishedDateElement = document.querySelector('.post-date');
            if (publishedDateElement) {
                return publishedDateElement.getAttribute('datetime');
            }
            return null;
        }


        function getModifiedDate() {
            var modifiedDateElement = document.querySelector('.post-modified');
            if (modifiedDateElement) {
                return modifiedDateElement.getAttribute('datetime');
            }
            return null;
        }


        function getMetaContent(name, fallback) {
            var metaByName = document.querySelector('meta[name="' + name + '"]');
            if (metaByName) {
                if (metaByName.content) return metaByName.content;
                return fallback;
            }
            var metaByProperty = document.querySelector('meta[property="' + name + '"]');
            if (metaByProperty) {
                if (metaByProperty.content) return metaByProperty.content;
                return fallback;
            }
            return fallback;
        }


        function cleanCanonicalUrl(url) {
            try {
                var urlObj = new URL(url);
                urlObj.search = '';
                urlObj.hash = '';
                return urlObj.toString();
            } catch (e) {
                return url.split('?')[0];
            }
        }


        function getImageFormat(imageUrl) {
            if (!imageUrl) return "";
            if (imageUrl.endsWith(".png")) return "image/png";
            if (imageUrl.endsWith(".jpg")) return "image/jpeg";
            if (imageUrl.endsWith(".jpeg")) return "image/jpeg";
            if (imageUrl.endsWith(".webp")) return "image/webp";
            if (imageUrl.endsWith(".gif")) return "image/gif";
            if (imageUrl.endsWith(".svg")) return "image/svg+xml";
            var extension = imageUrl.substring(imageUrl.lastIndexOf('.') + 1);
            if (extension) {
                return "image/" + extension.toLowerCase();
            }
            return "";
        }


        function getSchemaDefaultImageObjectFromMeta() {
            var imageUrl = getMetaContent('bigImage');
            if (!imageUrl) {
                return null;
            }
            var imageWidth = getMetaContent('bigImageWidth', '1200');
            var imageHeight = getMetaContent('bigImageHeight', '630');
            var imageAlt = getMetaContent('bigImageAlt', 'صورة موقع ' + blogName);


            return {
                "@type": "ImageObject",
                "url": imageUrl,
                "encodingFormat": getImageFormat(imageUrl),
                "width": imageWidth,
                "height": imageHeight,
                "alt": imageAlt
            };
        }


        function buildApiUrl(baseUrl, params) {
            var searchParams = new URLSearchParams();
            Object.entries(params).forEach(function(entry) {
                var key = entry[0];
                var value = entry[1];
                if (value) {
                    searchParams.append(key, value);
                }
            });
            return baseUrl + "?" + searchParams.toString();
        }


        function extractImageInfo(content) {
            if (!content) return null;
            try {
                var parser = new DOMParser();
                var doc = parser.parseFromString(content, 'text/html');
                var imgElement = doc.querySelector('img');


                if (!imgElement) return null;


                var imageUrl = imgElement.getAttribute('src');
                if (!imageUrl) return null;


                var naturalWidth = imgElement.naturalWidth;
                var naturalHeight = imgElement.naturalHeight;
                var attrWidth = parseInt(imgElement.getAttribute('width'), 10);
                var attrHeight = parseInt(imgElement.getAttribute('height'), 10);


                var finalWidth = null;
                if (naturalWidth) {
                    finalWidth = naturalWidth;
                } else if (attrWidth) {
                    finalWidth = attrWidth;
                }


                var finalHeight = null;
                if (naturalHeight) {
                    finalHeight = naturalHeight;
                } else if (attrHeight) {
                    finalHeight = attrHeight;
                }


                return {
                    "@type": "ImageObject",
                    "url": imageUrl,
                    "encodingFormat": getImageFormat(imageUrl),
                    "width": finalWidth,
                    "height": finalHeight,
                    "alt": imgElement.getAttribute('alt') || document.title
                };
            } catch (e) {
                console.warn('Failed to parse content or extract image:', e);
                return null;
            }
        }


        async function fetchPostDataByPath(path) {
            if (!BLOGGER_API_CONFIG.blogId) {
                console.error('Missing blogId in configuration.');
                return null;
            }
            if (!BLOGGER_API_CONFIG.apiKey) {
                console.error('Missing apiKey in configuration.');
                return null;
            }
            if (!path) {
                return null;
            }


            var baseUrl = "https://www.googleapis.com/blogger/v3/blogs/" + BLOGGER_API_CONFIG.blogId + "/posts/bypath";
            var params = {
                key: BLOGGER_API_CONFIG.apiKey,
                path: path,
                fields: 'content,author(displayName,url,image(url))'
            };


            try {
                var url = buildApiUrl(baseUrl, params);
                var response = await fetch(url);


                if (!response.ok) {
                    console.error('API Response Error Status:', response.status);
                    return null;
                }
                var data = await response.json();
                return data;
            } catch (error) {
                console.error('Error fetching Blogger post by path:', error);
                return null;
            }
        }


        function getAuthorImageWithDimensions(author) {
            return new Promise(function(resolve) {
                if (author) {
                    if (author.image) {
                        if (author.image.url) {
                            var authorImageUrl = author.image.url;
                            var img = new Image();
                            img.onload = function() {
                                resolve({
                                    "@type": "ImageObject",
                                    "url": authorImageUrl,
                                    "encodingFormat": getImageFormat(authorImageUrl),
                                    "width": this.naturalWidth,
                                    "height": this.naturalHeight,
                                    "alt": "صورة المؤلف " + author.displayName
                                });
                            };
                            img.onerror = function() {
                                resolve(null);
                            };
                            img.src = authorImageUrl;
                            return;
                        }
                    }
                }
                resolve(null);
            });
        }


        function getArticleHeadline() {
            var metaHeadlineElement = document.querySelector('meta[name="headline"]');
            if (metaHeadlineElement) {
                return metaHeadlineElement.getAttribute('content').trim();
            }
            var headlineElement = document.querySelector('h1.posts-h1-title.entry-title');
            if (headlineElement) {
                return headlineElement.textContent.trim();
            }
            return blogName;
        }


        function getPageId() {
            var canonicalLink = document.querySelector('link[rel="canonical"]');
            if (canonicalLink) {
                return canonicalLink.href;
            }
            return window.location.href.replace(/(\?)?m=1($)?/gi, '');
        }


        function getArticleBody() {
            var articleBodyElement = document.querySelector('.post-body');
            if (!articleBodyElement) {
                articleBodyElement = document.querySelector('#Blog1 > div > div > div > div.post.hentry > div.post-body.entry-content');
            }
            if (!articleBodyElement) {
                articleBodyElement = document.querySelector('#Blog1 > div > div > div > div.blog-posts.hfeed > div > div > div > div.post.hentry > div.post-body.entry-content');
            }
            if (!articleBodyElement) {
                articleBodyElement = document.querySelector('.post-body, .post-content, .entry-content');
            }


            if (!articleBodyElement) return "";


            var tempDiv = document.createElement('div');
            tempDiv.innerHTML = articleBodyElement.innerHTML;


            var unwantedSelectors = [
                'script', 'style', 'span', 'iframe', 'noscript', 'i', 'button', 'p',
                '.list-container', '.author-pro-box', '.news-frame-container',
                '.article-link-container', '.drawers-qap-section', '#posts-share',
                '.related-posts', '.related-posts-container', '[class*="related-"]',
                '.share-buttons', '[class*="share-"]', '.author-box', '[class*="author-"]',
                '.post-labels', '.post-tages-names'
            ];
            tempDiv.querySelectorAll(unwantedSelectors.join(', ')).forEach(function(el) {
                el.remove();
            });


            var qaScript = tempDiv.querySelector('script#qaData');
            var qaText = "";


            if (qaScript) {
                try {
                    var qaData = JSON.parse(qaScript.textContent);
                    if (qaData) {
                        if (Object.prototype.hasOwnProperty.call(qaData, 'mainEntity')) {
                            var mainEntity = qaData.mainEntity;
                            if (mainEntity) {
                                var hasText = Object.prototype.hasOwnProperty.call(mainEntity, 'text');
                                if (hasText) {
                                    var hasAcceptedAnswer = Object.prototype.hasOwnProperty.call(mainEntity, 'acceptedAnswer');
                                    if (hasAcceptedAnswer) {
                                        var acceptedAnswer = mainEntity.acceptedAnswer;
                                        if (acceptedAnswer) {
                                            if (Object.prototype.hasOwnProperty.call(acceptedAnswer, 'text')) {
                                                qaText += "السؤال: " + mainEntity.text + "\n";
                                                qaText += "الجواب: " + acceptedAnswer.text + "\n";
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        if (Object.prototype.hasOwnProperty.call(qaData, 'hasPart')) {
                            var hasPart = qaData.hasPart;
                            if (hasPart) {
                                if (Array.isArray(hasPart)) {
                                    hasPart.forEach(function(question) {
                                        if (question) {
                                            var hasText = Object.prototype.hasOwnProperty.call(question, 'text');
                                            if (hasText) {
                                                var hasAcceptedAnswer = Object.prototype.hasOwnProperty.call(question, 'acceptedAnswer');
                                                if (hasAcceptedAnswer) {
                                                    var acceptedAnswer = question.acceptedAnswer;
                                                    if (acceptedAnswer) {
                                                        if (Object.prototype.hasOwnProperty.call(acceptedAnswer, 'text')) {
                                                            qaText += "السؤال: " + question.text + "\n";
                                                            qaText += "الجواب: " + acceptedAnswer.text + "\n";
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    });
                                }
                            }
                        }
                    }
                } catch (error) {}
                if (qaText) {
                    qaScript.insertAdjacentText('beforebegin', qaText);
                }
                qaScript.remove();
            }


            var blogPostingScript = tempDiv.querySelector('script#blogPostingUserComments');
            var commentsText = "";


            if (blogPostingScript) {
                try {
                    var blogPostingData = JSON.parse(blogPostingScript.textContent);
                    if (blogPostingData) {
                        if (Object.prototype.hasOwnProperty.call(blogPostingData, 'userComments')) {
                            var userComments = blogPostingData.userComments;
                            if (userComments) {
                                if (Array.isArray(userComments)) {
                                    userComments.forEach(function(comment) {
                                        if (comment) {
                                            var hasAuthor = Object.prototype.hasOwnProperty.call(comment, 'author');
                                            if (hasAuthor) {
                                                var hasComment = Object.prototype.hasOwnProperty.call(comment, 'comment');
                                                if (hasComment) {
                                                    commentsText += comment.author + " يقول: " + comment.comment + "\n";
                                                }
                                            }
                                        }
                                    });
                                }
                            }
                        }
                    }
                } catch (error) {}
                if (commentsText) {
                    blogPostingScript.insertAdjacentText('beforebegin', commentsText);
                }
                blogPostingScript.remove();
            }


            var unwantedText = 'أسئلة وأجوبة';
            var regex = new RegExp(unwantedText.replace(/[\s]/g, '\\s*'), 'gi');
            tempDiv.innerHTML = tempDiv.innerHTML.replace(regex, '');


            return tempDiv.textContent.trim().replace(/\s+/g, ' ');
        }


        function getWordCount(text) {
            if (!text) return 0;
            return text.trim().split(/\s+/).length;
        }


        function getReadingTime(wordCount) {
            var wordsPerMinute = 180;
            var minutes = Math.ceil(wordCount / wordsPerMinute);
            return minutes;
        }


        function getArticleSection() {
            var articleSection = getMetaContent('article:section');
            if (articleSection) {
                return {
                    name: articleSection,
                    url: siteUrl + '/search/label/' + encodeURIComponent(articleSection)
                };
            }


            var labels = document.querySelector('.post-labels');
            var tags = document.querySelector('.post-tages-names');
            var category = "";
            var categoryUrl = "";


            if (labels) {
                labels.querySelectorAll('a').forEach(function(link) {
                    if (link.textContent) {
                        var trimmedText = link.textContent.trim();
                        if (trimmedText !== 'الرئيسية') {
                            category = trimmedText;
                            categoryUrl = link.href;
                        }
                    }
                });
            } else {
                if (tags) {
                    tags.querySelectorAll('a').forEach(function(link) {
                        if (link.textContent) {
                            var trimmedText = link.textContent.trim();
                            if (trimmedText !== 'الرئيسية') {
                                category = trimmedText;
                                categoryUrl = link.href;
                            }
                        }
                    });
                }
            }


            var finalName = 'غير مصنف';
            if (category) {
                finalName = category;
            }


            var finalUrl = '#';
            if (categoryUrl) {
                finalUrl = categoryUrl;
            }


            return {
                name: finalName,
                url: finalUrl
            };
        }


        function getSameAsLinks() {
            var labels = document.querySelector('.post-labels');
            var tags = document.querySelector('.post-tages-names');
            var sameAsLinks = [];


            function addSameAsLink(label) {
                var lowerLabel = label.toLowerCase();
                var mapping = {
                    'breaking': "https://ar.wikipedia.org/wiki/%D8%A3%D8%AE%D8%A8%D8%A7%D8%B1_%D8%B9%D8%A7%D8%AC%D9%84%D8%A9",
                    'عاجل': "https://ar.wikipedia.org/wiki/%D8%A3%D8%AE%D8%A8%D8%A7%D8%B1_%D8%B9%D8%A7%D8%AC%D9%84%D8%A9",
                    'egypt': "https://ar.wikipedia.org/wiki/%D8%A3%D8%AE%D8%A8%D8%A7%D8%B1_%D9%85%D8%AD%D9%84%D9%8A%D8%A9",
                    'مصر': "https://ar.wikipedia.org/wiki/%D8%A3%D8%AE%D8%A8%D8%A7%D8%B1_%D9%85%D8%AD%D9%84%D9%8A%D8%A9",
                    'world': "https://ar.wikipedia.org/wiki/%D8%A3%D8%AE%D8%A8%D8%A7%D8%B1_%D8%B9%D8%A7%D9%84%D9%85%D9%8A%D8%A9",
                    'العالم': "https://ar.wikipedia.org/wiki/%D8%A3%D8%AE%D8%A8%D8%A7%D8%B1_%D8%B9%D8%A7%D9%84%D9%85%D9%8A%D8%A9",
                    'sports': "https://ar.wikipedia.org/wiki/%D8%A8%D9%88%D8%A7%D8%A8%D8%A9:%D8%B1%D9%8A%D8%A7%D8%B6%D8%A9/%D8%A3%D8%AE%D8%A8%D8%A7%D8%B1_%D8%B1%D9%8A%D8%A7%D8%B6%D8%A9",
                    'رياضة': "https://ar.wikipedia.org/wiki/%D8%A8%D9%88%D8%A7%D8%A8%D8%A9:%D8%B1%D9%8A%D8%A7%D8%B6%D8%A9/%D8%A3%D8%AE%D8%A8%D8%A7%D8%B1_%D8%B1%D9%8A%D8%A7%D8%B6%D8%A9",
                    'culture': "https://ar.wikipedia.org/wiki/%D8%A8%D9%88%D8%A7%D8%A8%D8%A9:%D9%81%D9%86%D9%88%D9%86",
                    'ثقافة وفن': "https://ar.wikipedia.org/wiki/%D8%A8%D9%88%D8%A7%D8%A8%D8%A9:%D9%81%D9%86%D9%88%D9%86",
                    'health': "https://ar.wikipedia.org/wiki/%D8%B5%D8%AD%D8%A9",
                    'صحة': "https://ar.wikipedia.org/wiki/%D8%B5%D8%AD%D8%A9",
                    'food': "https://ar.wikipedia.org/wiki/%D9%85%D8%B7%D8%A8%D8%AE",
                    'مطبخ': "https://ar.wikipedia.org/wiki/%D9%85%D8%B7%D8%A8%D8%AE",
                    'beauty': "https://ar.wikipedia.org/wiki/%D8%A7%D9%85%D8%B1%D8%A3%D8%A9",
                    'هى': "https://ar.wikipedia.org/wiki/%D8%A7%D9%85%D8%B1%D8%A3%D8%A9",
                    'horoscope': "https://ar.wikipedia.org/wiki/%D8%AA%D9%86%D8%AC%D9%8A%D9%85",
                    'أبراج': "https://ar.wikipedia.org/wiki/%D8%AA%D9%86%D8%AC%D9%8A%D9%85",
                    'tech': "https://ar.wikipedia.org/wiki/%D8%AA%D9%82%D8%A7%D9%86%D8%A9",
                    'تكنولوجيا': "https://ar.wikipedia.org/wiki/%D8%AA%D9%82%D8%A7%D9%86%D8%A9",
                    'markets': "https://ar.wikipedia.org/wiki/%D8%B3%D9%88%D9%82",
                    'أسواق': "https://ar.wikipedia.org/wiki/%D8%B3%D9%88%D9%82",
                    'services': "https://ar.wikipedia.org/wiki/%D8%AE%D8%AF%D9%85%D8%A9_(%D8%A7%D9%82%D8%AA%D8%B5%D8%A7%D8%AF)",
                    'خدمات': "https://ar.wikipedia.org/wiki/%D8%AE%D8%AF%D9%85%D8%A9_(%D8%A7%D9%82%D8%AA%D8%B5%D8%A7%D8%AF)",
                    'environment': "https://ar.wikipedia.org/wiki/%D8%A8%D9%8A%D8%A6%D8%A9",
                    'بيئة ومناخ': "https://ar.wikipedia.org/wiki/%D8%A8%D9%8A%D8%A6%D8%A9",
                    'sciences': "https://ar.wikipedia.org/wiki/%D8%B9%D9%84%D9%85",
                    'علوم': "https://ar.wikipedia.org/wiki/%D8%B9%D9%84%D9%85"
                };
                if (mapping[lowerLabel]) {
                    sameAsLinks.push(mapping[lowerLabel]);
                }
            }


            if (labels) {
                labels.querySelectorAll('a').forEach(function(link) {
                    var label = link.textContent.trim();
                    addSameAsLink(label);
                });
            } else {
                if (tags) {
                    tags.querySelectorAll('a').forEach(function(link) {
                        var label = link.textContent.trim();
                        addSameAsLink(label);
                    });
                }
            }
            if (sameAsLinks.length > 0) {
                return sameAsLinks;
            } else {
                return ["https://ar.wikipedia.org/wiki/%D8%AE%D8%A8%D8%B1_(%D8%A5%D8%B9%D9%84%D8%A7%D9%85)"];
            }
        }


        function getPublisherData() {
            var publisherLogoUrl = getMetaContent('publisherLogo', '');
            return {
                "@type": "Organization",
                name: getMetaContent('Publisher', ''),
                url: getMetaContent('publisherUrl', ''),
                logo: {
                    "@type": "ImageObject",
                    "url": publisherLogoUrl,
                    "encodingFormat": getImageFormat(publisherLogoUrl),
                    "width": getMetaContent('publisherLogoWidth', ''),
                    "height": getMetaContent('publisherLogoHeight', ''),
                    "alt": getMetaContent('publisherLogoAlt', '')
                }
            };
        }


        function gatherAllKeywords() {
            var stopWords = new Set([
                'في', 'على', 'عن', 'إلى', 'من', 'حتى', 'مذ', 'منذ', 'بين',
                'أمام', 'خلف', 'تحت', 'فوق', 'عند', 'لدى', 'نحو', 'إلا',
                'ال', 'هذا', 'هذه', 'هؤلاء', 'ذلك', 'تلك', 'أنا', 'أنت',
                'هو', 'هي', 'نحن', 'أنتم', 'هم', 'و', 'أو', 'لكن', 'ثم',
                'أم', 'الذي', 'التي', 'الذين', 'اللواتي', 'حيث',
                'إذا', 'إن', 'إذ', 'كان', 'يكون', 'أصبح', 'صار', 'ظل',
                'ما زال', 'شيء', 'أحد', 'بعض', 'كل', 'أي', 'لا شيء',
                'الى', 'ب', 'ل', 'ك', 'ف', 'بل', 'لا', 'أنتي', 'أنتما',
                'أنتن', 'هما', 'هن', 'اللاتي', 'اللائي', 'هذان', 'هاتان',
                'أولئك', 'هل', 'ما', 'ماذا', 'لماذا', 'كيف', 'كم', 'أين',
                'متى', 'اي', 'يا', 'أيها', 'أيتها', 'ليس', 'غير', 'سوى',
                'فقط', 'أيضا', 'أيضاً', 'قد', 'لقد', 'سوف', 'أن', 'كأن',
                'ليت', 'لعل', 'مع', 'قبل', 'بعد', 'جدا', 'جداً', 'بـ',
                'كـ', 'لـ', 'فـ', 'كي', 'الـ', 'الذان', 'اللتان', 'لم',
                'لن', 'لما', 'لو', 'لولا', 'هناك', 'هنا', 'نفس', 'مثل'
            ]);


            var phrasesBlacklist = new Set([
                'اقرأ أيضا', 'اقرأ ايضا', 'شاهد أيضا', 'شاهد ايضا', 'مواضيع ذات صلة',
                'شارك المقال', 'تابعنا على', 'قد يهمك', 'في هذا المقال', 'لهذا السبب',
                'بشكل كبير', 'في الوقت الحالي', 'في السطور التالية', 'السطور التالية'
            ]);


            var phraseFrequencies = {};


            function normalizeWord(word) {
                if (!word) return '';
                return word.trim().toLowerCase()
                    .replace(/[^\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\w\s-]/g, '');
            }


            function processText(text, weight) {
                if (!text) return;


                var words = text.split(/\s+/).map(normalizeWord).filter(function(word) {
                    if (word.length > 2) {
                        if (!stopWords.has(word)) {
                            return true;
                        }
                    }
                    return false;
                });


                words.forEach(function(word) {
                    if (!phraseFrequencies[word]) {
                        phraseFrequencies[word] = 0;
                    }
                    phraseFrequencies[word] += weight;
                });


                words.slice(0, words.length - 1).forEach(function(currentWord, index) {
                    var phrase_bi = currentWord + ' ' + words[index + 1];
                    if (!phraseFrequencies[phrase_bi]) {
                        phraseFrequencies[phrase_bi] = 0;
                    }
                    phraseFrequencies[phrase_bi] += weight;
                });


                words.slice(0, words.length - 2).forEach(function(currentWord, index) {
                    var phrase_tri = currentWord + ' ' + words[index + 1] + ' ' + words[index + 2];
                    if (!phraseFrequencies[phrase_tri]) {
                        phraseFrequencies[phrase_tri] = 0;
                    }
                    phraseFrequencies[phrase_tri] += weight;
                });
            }


            var titleText = getArticleHeadline();
            var descriptionText = getMetaContent('description', '');
            var bodyText = getArticleBody();
            var keywordsMeta = getMetaContent('keywords', '');


            if (keywordsMeta) {
                var manualKeywords = keywordsMeta.split(',');
                manualKeywords.forEach(function(keyword) {
                    var cleanKeyword = keyword.trim();
                    if (cleanKeyword) {
                        phraseFrequencies[normalizeWord(cleanKeyword)] = 1000;
                    }
                });
            }


            processText(titleText, 5);
            processText(descriptionText, 3);


            var bodyWords = bodyText.split(/\s+/);
            var totalWords = bodyWords.length;
            var minWordsForSplit = 50;


            if (totalWords > minWordsForSplit) {
                var introEndPoint = Math.floor(totalWords * 0.20);
                var conclusionStartPoint = Math.floor(totalWords * 0.80);


                var introText = bodyWords.slice(0, introEndPoint).join(' ');
                var middleText = bodyWords.slice(introEndPoint, conclusionStartPoint).join(' ');
                var conclusionText = bodyWords.slice(conclusionStartPoint).join(' ');


                processText(introText, 2);
                processText(middleText, 1);
                processText(conclusionText, 2.5);


            } else {
                processText(bodyText, 1);
            }


            var sortedKeywords = Object.keys(phraseFrequencies).sort(function(a, b) {
                return phraseFrequencies[b] - phraseFrequencies[a];
            });


            var finalKeywords = sortedKeywords.filter(function(keyword) {
                if (phrasesBlacklist.has(keyword)) {
                    return false;
                }
                return true;
            });


            return {
                keywords: finalKeywords,
                frequencies: phraseFrequencies
            };
        }


        function createTagsSection(keywordsForDisplay, container) {
            if (!keywordsForDisplay) return;
            if (keywordsForDisplay.length === 0) return;
            if (!container) return;


            var searchURLStructure = siteUrl + '/search?q=';
            var tagsWrapper = document.createElement('div');
            tagsWrapper.className = 'post-tags-container';


            var titleDiv = document.createElement('div');
            titleDiv.className = 'post-tags-title';


            var tagIcon = document.createElement('i');
            tagIcon.className = 'fa fa-tag';
            titleDiv.appendChild(tagIcon);


            var titleText = document.createElement('span');
            titleText.textContent = 'الكلمات المفتاحية';
            titleDiv.appendChild(titleText);
            tagsWrapper.appendChild(titleDiv);


            var tagsList = document.createElement('div');
            tagsList.className = 'post-tags-list';


            keywordsForDisplay.forEach(function(keyword) {
                var tagLink = document.createElement('a');
                tagLink.href = searchURLStructure + encodeURIComponent(keyword);
                tagLink.textContent = keyword;
                tagLink.rel = 'tag';
                tagLink.setAttribute('itemprop', 'keywords');
                tagsList.appendChild(tagLink);
            });
            tagsWrapper.appendChild(tagsList);


            var insertionPoint = document.querySelector('.comments-wrapper, .drawers-qap-section, .related-posts, .related-posts-container, [class*="related-"]');
            if (insertionPoint) {
                insertionPoint.parentNode.insertBefore(tagsWrapper, insertionPoint);
            } else {
                container.appendChild(tagsWrapper);
            }
        }


        function createInternalLinks(keywords, phraseFrequencies, container) {
            if (!keywords) return;
            if (keywords.length === 0) return;
            if (!container) return;


            var threshold = 5;
            var minLinks = 20;
            var maxLinks = 30;


            var strongKeywords = keywords.filter(function(keyword) {
                if (phraseFrequencies[keyword]) {
                    if (phraseFrequencies[keyword] > threshold) {
                        return true;
                    }
                }
                return false;
            });


            var keywordsForLinking = strongKeywords.slice(0, maxLinks);


            if (minLinks > keywordsForLinking.length) {
                keywordsForLinking = keywords.slice(0, minLinks);
            }


            if (keywordsForLinking.length === 0) {
                return;
            }


            var textNodes = [];
            var treeWalker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
            var node;
            while (node = treeWalker.nextNode()) {
                var parentElement = node.parentElement;
                if (parentElement) {
                    var tagName = parentElement.tagName.toLowerCase();
                    var isAllowed = true;
                    if (tagName === 'a' || tagName === 'script' || tagName === 'style') {
                        isAllowed = false;
                    }
                    if (isAllowed) {
                        var closestUnwanted = parentElement.closest('.post-tags-container, .list-title-container, .related-posts-section, .item .startpost h2, .item .startpost h3, .item .startpost h4, .static_page .startpost h2, .static_page .startpost h3, .static_page .startpost h4, .news-frame-container, .tr-caption, .dynamic-info-container, .article-link-container, .drawers-qap-section, .Linked-blogs-Dual-Module-Container, .ingredient-table-container, .recipe-times-table-container, .recipe-yield-table-container, .main-table, .trust-container, .rating-system');
                        if (closestUnwanted) {
                            isAllowed = false;
                        }
                    }
                    if (isAllowed) {
                        textNodes.push(node);
                    }
                }
            }


            if (textNodes.length === 0) {
                return;
            }


            var introEndPoint = Math.floor(textNodes.length * 0.25);
            var conclusionStartPoint = Math.floor(textNodes.length * 0.75);


            var introNodes = textNodes.slice(0, introEndPoint);
            var middleNodes = textNodes.slice(introEndPoint, conclusionStartPoint);
            var conclusionNodes = textNodes.slice(conclusionStartPoint);


            var numKeywordsTotal = keywordsForLinking.length;
            var numForIntro = Math.ceil(numKeywordsTotal / 3);
            var numForMiddle = Math.ceil((numKeywordsTotal - numForIntro) / 2);


            var keywordsForIntro = keywordsForLinking.splice(0, numForIntro);
            var keywordsForMiddle = keywordsForLinking.splice(0, numForMiddle);
            var keywordsForConclusion = keywordsForLinking;


            var linkedKeywords = new Set();
            var searchURLStructure = siteUrl + '/search?q=';


            function linkKeywordsInNodes(keywords, nodes) {
                keywords.forEach(function(keyword) {
                    var keywordLower = keyword.toLowerCase();
                    if (linkedKeywords.has(keywordLower)) {
                        return;
                    }


                    if (keyword.split(' ').length > 3) {
                        return;
                    }


                    var linkPlaced = false;
                    nodes.forEach(function(textNode) {
                        if (linkPlaced) {
                            return;
                        }


                        var nodeValue = textNode.nodeValue;
                        if (nodeValue) {
                            var keywordIndex = nodeValue.toLowerCase().indexOf(keywordLower);
                            if (keywordIndex !== -1) {
                                var linkNode = document.createElement('a');
                                linkNode.href = searchURLStructure + encodeURIComponent(keyword);
                                linkNode.className = 'auto-internal-link';
                                linkNode.rel = 'tag';
                                linkNode.textContent = nodeValue.substr(keywordIndex, keyword.length);


                                var startText = nodeValue.substring(0, keywordIndex);
                                var endText = nodeValue.substring(keywordIndex + keyword.length);


                                var fragment = document.createDocumentFragment();
                                if (startText) {
                                    fragment.appendChild(document.createTextNode(startText));
                                }
                                fragment.appendChild(linkNode);
                                if (endText) {
                                    fragment.appendChild(document.createTextNode(endText));
                                }


                                if (textNode.parentNode) {
                                    textNode.parentNode.classList.add('internal-link-parent');
                                    textNode.parentNode.replaceChild(fragment, textNode);
                                    linkedKeywords.add(keywordLower);
                                    linkPlaced = true;
                                }
                            }
                        }
                    });
                });
            }


            linkKeywordsInNodes(keywordsForIntro, introNodes);
            linkKeywordsInNodes(keywordsForMiddle, middleNodes);
            linkKeywordsInNodes(keywordsForConclusion, conclusionNodes);
        }


        async function fetchAndCacheAllPosts() {
            var cacheKey = 'blogger_post_index_news_24h';
            var cachedDataString = localStorage.getItem(cacheKey);


            if (cachedDataString) {
                try {
                    var cachedData = JSON.parse(cachedDataString);
                    if (cachedData) {
                        if (cachedData.timestamp) {
                            var now = new Date().getTime();
                            var cacheAge = now - cachedData.timestamp;
                            var twentyFourHoursInMillis = 24 * 60 * 60 * 1000;


                            if (cacheAge &lt; twentyFourHoursInMillis) {
                                if (cachedData.items) {
                                    return cachedData.items;
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.error("Failed to parse cached post index. Refetching.", e);
                }
            }


            if (!BLOGGER_API_CONFIG.blogId) {
                console.error('Missing blogId for fetching all posts.');
                return [];
            }
            if (!BLOGGER_API_CONFIG.apiKey) {
                console.error('Missing apiKey for fetching all posts.');
                return [];
            }


            var baseUrl = "https://www.googleapis.com/blogger/v3/blogs/" + BLOGGER_API_CONFIG.blogId + "/posts";
            var params = {
                key: BLOGGER_API_CONFIG.apiKey,
                fetchBodies: false,
                maxResults: 500,
                fields: 'items(title,url)'
            };


            try {
                var url = buildApiUrl(baseUrl, params);
                var response = await fetch(url);


                if (!response.ok) {
                    console.error('API Error when fetching all posts. Status:', response.status);
                    return [];
                }


                var data = await response.json();


                if (data.items) {
                    var dataToCache = {
                        timestamp: new Date().getTime(),
                        items: data.items
                    };
                    localStorage.setItem(cacheKey, JSON.stringify(dataToCache));
                    return data.items;
                }
                return [];


            } catch (error) {
                console.error('Error fetching all Blogger posts:', error);
                return [];
            }
        }


        function createAdvancedInternalLinks(postIndex, container) {
            if (!postIndex) return;
            if (postIndex.length === 0) return;
            if (!container) return;


            var maxNewLinks = 10;
            var linksCreated = 0;
            var linkedHrefs = new Set();
            var currentPageUrl = cleanCanonicalUrl(getPageId());


            var otherPosts = postIndex.filter(function(post) {
                if (post.url) {
                    return cleanCanonicalUrl(post.url) !== currentPageUrl;
                }
                return false;
            });


            otherPosts.sort(function() {
                return 0.5 - Math.random()
            });


            var textNodes = [];
            var treeWalker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
            var node;
            while (node = treeWalker.nextNode()) {
                var parentElement = node.parentElement;
                if (parentElement) {
                    var tagName = parentElement.tagName.toLowerCase();
                    var isAllowed = true;
                    if (tagName === 'a' || tagName === 'script' || tagName === 'style' || tagName === 'h1' || tagName === 'h2' || tagName === 'h3') {
                        isAllowed = false;
                    }
                    if (isAllowed) {
                        var closestUnwanted = parentElement.closest('.post-tags-container, .auto-internal-link');
                        if (closestUnwanted) {
                            isAllowed = false;
                        }
                    }
                    if (isAllowed) {
                        textNodes.push(node);
                    }
                }
            }


            if (textNodes.length === 0) {
                return;
            }


            otherPosts.forEach(function(post) {
                if (linksCreated >= maxNewLinks) {
                    return;
                }
                if (post.title) {
                    if (post.title.length > 15) {
                        if (post.title.includes(' ')) {
                            if (!linkedHrefs.has(post.url)) {
                                var linkPlaced = false;
                                textNodes.forEach(function(textNode) {
                                    if (linkPlaced) return;
                                    if (linksCreated >= maxNewLinks) return;


                                    var nodeValue = textNode.nodeValue;
                                    if (nodeValue) {
                                        var keywordIndex = nodeValue.toLowerCase().indexOf(post.title.toLowerCase());
                                        if (keywordIndex !== -1) {
                                            var linkNode = document.createElement('a');
                                            linkNode.href = post.url;
                                            linkNode.className = 'advanced-internal-link';
                                            linkNode.textContent = nodeValue.substr(keywordIndex, post.title.length);


                                            var startText = nodeValue.substring(0, keywordIndex);
                                            var endText = nodeValue.substring(keywordIndex + post.title.length);


                                            var fragment = document.createDocumentFragment();
                                            if (startText) {
                                                fragment.appendChild(document.createTextNode(startText));
                                            }
                                            fragment.appendChild(linkNode);
                                            if (endText) {
                                                fragment.appendChild(document.createTextNode(endText));
                                            }


                                            if (textNode.parentNode) {
                                                textNode.parentNode.replaceChild(fragment, textNode);
                                                linkedHrefs.add(post.url);
                                                linksCreated++;
                                                linkPlaced = true;
                                            }
                                        }
                                    }
                                });
                            }
                        }
                    }
                }
            });
        }


        applyColors();
        var keywordData = gatherAllKeywords();
        var topKeywords = keywordData.keywords;
        var phraseFrequencies = keywordData.frequencies;


        var threshold = 5;
        var minKeywords = 4;
        var maxKeywords = 8;


        var strongKeywords = topKeywords.filter(function(keyword) {
            if (phraseFrequencies[keyword]) {
                if (phraseFrequencies[keyword] > threshold) {
                    return true;
                }
            }
            return false;
        });


        var keywordsForDisplay = strongKeywords.slice(0, maxKeywords);


        if (minKeywords > keywordsForDisplay.length) {
            keywordsForDisplay = topKeywords.slice(0, minKeywords);
        }


        var currentPath = window.location.pathname.split('?')[0];


        if (isPostPage) {
            fetchPostDataByPath(currentPath).then(async function(postData) {
                var finalImage;
                var finalAuthorData;


                if (postData) {
                    var authorName = blogName;
                    if (postData.author) {
                        if (postData.author.displayName) {
                            authorName = postData.author.displayName;
                        }
                    }
                    var authorUrl = siteUrl;
                    if (postData.author) {
                        if (postData.author.url) {
                            authorUrl = postData.author.url;
                        }
                    }


                    finalAuthorData = {
                        "@type": "Person",
                        "name": authorName,
                        "url": authorUrl
                    };


                    var authorImageObject = await getAuthorImageWithDimensions(postData.author);
                    if (authorImageObject) {
                        finalAuthorData.image = authorImageObject;
                    }


                    finalImage = extractImageInfo(postData.content);
                }


                if (!finalAuthorData) {
                    finalAuthorData = {
                        "@type": "Person",
                        "name": blogName,
                        "url": siteUrl
                    };
                }


                if (!finalImage) {
                    finalImage = getSchemaDefaultImageObjectFromMeta();
                    if (!finalImage) {
                        finalImage = {
                            "@type": "ImageObject",
                            "url": siteUrl + "/image/logo.webp",
                            "encodingFormat": "image/webp",
                            "width": 1200,
                            "height": 630,
                            "alt": "صورة موقع " + blogName
                        };
                    }
                }


                var datePublishedValue = getPublishedDate();
                var datePublished = convertToISO8601(datePublishedValue);
                if (!datePublished) {
                    datePublished = convertToISO8601(new Date().toISOString());
                }


                var dateModifiedValue = getModifiedDate();
                var dateModified = convertToISO8601(dateModifiedValue);
                if (!dateModified) {
                    dateModified = datePublished;
                }


                var headline = getArticleHeadline();
                var description = getMetaContent('description', 'لا يوجد وصف متاح');
                var articleSectionData = getArticleSection();
                var articleBody = getArticleBody();
                var wordCount = getWordCount(articleBody);
                var readingTime = getReadingTime(wordCount);
                var sameAsLinks = getSameAsLinks();
                var publisherData = getPublisherData();
                var cleanUrl = cleanCanonicalUrl(getPageId());


                var schemaData = {
                    "@context": "https://schema.org",
                    "@type": "NewsArticle",
                    "headline": headline,
                    "description": description,
                    "keywords": keywordsForDisplay.join(', '),
                    "datePublished": datePublished,
                    "dateModified": dateModified,
                    "dateCreated": datePublished,
                    "mainEntityOfPage": {
                        "@type": "WebPage",
                        "@id": cleanUrl
                    },
                    "image": finalImage,
                    "articleSection": articleSectionData.name,
                    "articleBody": articleBody,
                    "wordCount": wordCount,
                    "timeRequired": "PT" + readingTime + "M",
                    "author": finalAuthorData,
                    "publisher": publisherData,
                    "speakable": {
                        "@type": "SpeakableSpecification",
                        "text": articleBody
                    },
                    "about": {
                        "@type": "Thing",
                        "name": headline,
                        "description": description,
                        "sameAs": sameAsLinks
                    },
                    "inLanguage": "ar",
                    "isAccessibleForFree": true,
                    "accessMode": ["textual", "visual"],
                    "accessModeSufficient": ["textual", "visual"]
                };


                var script = document.createElement('script');
                script.type = 'application/ld+json';
                script.classList.add('js-schema-NewsArticle');
                script.textContent = JSON.stringify(schemaData, null, 2);
                document.head.appendChild(script);


                var postContainer = document.querySelector('.post-body, .post-content, .entry-content');
                if (postContainer) {
                    if (keywordsForDisplay.length > 0) {
                        createTagsSection(keywordsForDisplay, postContainer);
                    }
                }
            });
        }


        if (isPostPage || isStaticPage) {
            var postContainer = document.querySelector('.post-body, .post-content, .entry-content');
            if (postContainer) {
                if (topKeywords.length > 0) {
                    createInternalLinks(topKeywords, phraseFrequencies, postContainer);
                }


                fetchAndCacheAllPosts().then(function(postIndex) {
                    if (postIndex.length > 0) {
                        createAdvancedInternalLinks(postIndex, postContainer);
                    }
                });
            }
        }
    });
