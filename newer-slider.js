(function($) {
  let newerCategoryTranslations = {};
  const newerFeaturedSnippetMaxChars = 380;
  let allPosts = [];
  let displayedPostCount = 0;
  const postsPerBatch = 20;
  const initialLoadCount = 25;
  const featuredPostCount = 5;
  let totalBlogPosts = 0;
  let nextStartIndex = 1;
  let isLoading = false;
  let initialDataPromise = null;




  function shouldDisplayWidget() {
    const currentPath = window.location.pathname;
    const isHomePage = ["/", "", "/index.html"].includes(currentPath);
    const isCategoryPage = currentPath.includes("/search/label/");
    return isHomePage || isCategoryPage;
  }




  function newerGetMetaContent(name) {
    const metaTag = document.querySelector(`meta[name="${name}"]`);
    return metaTag ? metaTag.content : null;
  }




  function newerGetCategoryTranslations() {
    const metaContent = newerGetMetaContent("category-translations");
    if (metaContent) {
      try {
        const cleanContent = metaContent.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
        newerCategoryTranslations = JSON.parse(cleanContent);
      } catch (e) {
        console.error("Error parsing category translations:", e);
        newerCategoryTranslations = {};
      }
    } else {
      console.warn("Meta tag 'category-translations' not found. Using default category display.");
      newerCategoryTranslations = {};
    }
  }




  function newerTranslateCategory(categorySlug) {
    if (!categorySlug) return { text: "غير مصنف", icon: "📌" };
    const lowerCaseSlug = categorySlug.toLowerCase();
    const translation = newerCategoryTranslations[lowerCaseSlug];
    if (translation) {
      return { text: translation.label || categorySlug, icon: translation.icon || "📌" };
    }
    return { text: categorySlug, icon: "📌" };
  }




  function newerName() {
    return newerGetMetaContent("site-name") || document.title || "اسم الموقع";
  }




  function newerGetMetaDescription() {
    return newerGetMetaContent("description") || "";
  }




  function newerSetWidgetTitleAndDescription() {
    const currentPath = window.location.pathname;
    const isHomePage = ["/", "", "/index.html"].includes(currentPath);
    const isCategoryPage = currentPath.includes("/search/label/");
    const newerHeader = $(".newer-slider-header");
    const headerPreTitle = $(".newer-header-pre-title");
    const headerTitle = $("#newerWidgetTitle");
    const descriptionDiv = $("#newerWidgetDescription");
    headerPreTitle.text("");
    headerTitle.text("");
    descriptionDiv.text("");
    newerHeader.removeClass('is-visible').hide();
    if (isCategoryPage) {
      const categoryLabel = decodeURIComponent(currentPath.split("/search/label/")[1].split("?")[0].replace(/\+/g, " "));
      const lowerCaseCategory = categoryLabel.toLowerCase();
      const translation = newerCategoryTranslations[lowerCaseCategory];
      const translatedTitle = translation ? translation.label : categoryLabel;
      const categoryDescription = translation ? translation.description : "";
      headerPreTitle.text("");
      headerTitle.text(translatedTitle);
      descriptionDiv.text(categoryDescription);
      newerHeader.addClass('is-visible').show();
    } else if (isHomePage) {
      headerPreTitle.text("أحدث موضوعات الموقع");
      headerTitle.text(newerName());
      descriptionDiv.text(newerGetMetaDescription() || "آخر المقالات المميزة");
    }
  }




  function newerExtractPostDetailsFromFeedEntry(entry) {
    if (!entry) return null;
    const url = entry.link.find((link) => link.rel === "alternate")?.href || "#";
    const title = entry.title?.$t || "بدون عنوان";
    let imageUrl = "https://via.placeholder.com/800x450/eee/aaa?text=No+Image";
    if (entry.media$thumbnail?.url) {
      imageUrl = entry.media$thumbnail.url.replace(/\/s[0-9]+.*?\/|\/w[0-9]+.*?-c\//, "/s800/");
    } else {
      const contentToCheck = entry.content?.$t || entry.summary?.$t;
      if (contentToCheck) {
        const imgMatch = contentToCheck.match(/<img[^>]*src="([^"]*)"/i);
        if (imgMatch && imgMatch[1]) {
          if (!imgMatch[1].startsWith("data:")) {
            imageUrl = imgMatch[1].split("?")[0].replace(/\/s[0-9]+.*?\/|\/w[0-9]+.*?-c\//, "/s800/");
          }
        }
      }
    }
    let postDate = "-",
      postTime = "-";
    try {
      if (entry.published?.$t) {
        const dateObj = new Date(entry.published.$t);
        if (!isNaN(dateObj.getTime())) {
          postDate = dateObj.toLocaleDateString("ar-EG", { month: "short", day: "numeric", year: "numeric" });
          postTime = dateObj.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
        }
      }
    } catch (e) { console.error("Error parsing date:", e, entry.published.$t); }
    const authorName = entry.author?.[0]?.name?.$t || "محرر";
    const categoryObj = entry.category?.find(cat => !cat.term.startsWith("http://schemas.google.com/"));
    const categorySlug = categoryObj ? categoryObj.term : null;
    let rawSnippetText = entry.content?.$t || entry.summary?.$t || "";
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = rawSnippetText;
    tempDiv.querySelectorAll("script, style, iframe, object, embed, video, audio, table, form, .ss-hidden").forEach(el => el.remove());
    let cleanSnippet = (tempDiv.textContent || "").replace(/\s+/g, " ").trim();
    let featuredSnippet = cleanSnippet;
    let isFeaturedSnippetTruncated = false;
    if (featuredSnippet.length > newerFeaturedSnippetMaxChars) {
      featuredSnippet = featuredSnippet.substring(0, newerFeaturedSnippetMaxChars);
      const lastSpace = featuredSnippet.lastIndexOf(' ');
      if (lastSpace !== -1) featuredSnippet = featuredSnippet.substring(0, lastSpace);
      isFeaturedSnippetTruncated = true;
    }
    return { title, url, image: imageUrl, date: postDate, time: postTime, author: authorName, categorySlug, snippet: cleanSnippet, featuredSnippet, isFeaturedSnippetTruncated };
  }
  
  const newerRenderSlider = (post) => {
    if (!post || !post.url) return "";
    const translatedCategory = newerTranslateCategory(post.categorySlug);
    const sizedImage = post.image;
    let categoryLabelElement = "";
    if (post.categorySlug) {
      categoryLabelElement = `<a href="/search/label/${encodeURIComponent(post.categorySlug)}" class="newer-item-category-label" title="عرض المزيد في ${translatedCategory.text}"><span class="newer-ribbon-icon">${translatedCategory.icon}</span><span class="newer-ribbon-text">${translatedCategory.text}</span></a>`;
    }
    const metaInfo = `<div class="newer-slider-meta-info"><div><span>&#9997;&#65039; ${post.author}</span></div><div><span>📅 ${post.date}</span> <span>&#9200; ${post.time}</span></div></div>`;
    const snippetHtml = post.snippet ? `<div class="newer-snippet">${post.snippet}</div>` : "";
    return `<div class="newer-slider-single-item">${categoryLabelElement}<a href="${post.url}" target="_blank" class="newer-slider-item-link" title="${post.title}"><div class="newer-slider-image-wrapper"><img src="${sizedImage}" class="newer-slider-main-image" alt="${post.title}" loading="lazy"/></div>${metaInfo}<div class="newer-slider-item-content-area"><h3 class="newer-slider-item-secondary-title">${post.title}</h3>${snippetHtml}</div></a></div>`;
  };
  
  const newerRenderFeaturedSlider = (post) => {
    if (!post || !post.url) return "";
    const translatedCategory = newerTranslateCategory(post.categorySlug);
    const sizedImage = post.image;
    let categoryLabelElement = "";
    if (post.categorySlug) {
      categoryLabelElement = `<a href="/search/label/${encodeURIComponent(post.categorySlug)}" class="newer-item-category-label" title="عرض المزيد في ${translatedCategory.text}"><span class="newer-ribbon-icon">${translatedCategory.icon}</span><span class="newer-ribbon-text">${translatedCategory.text}</span></a>`;
    }
    const metaInfo = `<div class="newer-slider-meta-info"><div><span>&#9997;&#65039; ${post.author}</span></div><div><span>📅 ${post.date}</span> <span>&#9200; ${post.time}</span></div></div>`;
    let snippetContent = post.featuredSnippet || "";
    if (post.isFeaturedSnippetTruncated) snippetContent += '...';
    const snippetHtml = snippetContent ? `<div class="newer-snippet">${snippetContent}</div>` : "";
    return `<div class="newer-slider-featured-item">${categoryLabelElement}<a href="${post.url}" target="_blank" class="newer-slider-item-link" title="${post.title}"><div class="newer-slider-image-wrapper"><img src="${sizedImage}" class="newer-slider-main-image" alt="${post.title}"/></div><div class="newer-slider-item-content-area"><h3 class="newer-slider-item-secondary-title">${post.title}</h3>${snippetHtml}${metaInfo}</div></a></div>`;
  };




  function newerUpdateLoadMoreState() {
    const $loadMoreButtons = $(".newer-load-more-button");
    const $loadingMessages = $(".newer-loading-message");
    const $noMoreMessages = $(".newer-no-more-posts");
    $loadMoreButtons.hide();
    $loadingMessages.hide();
    $noMoreMessages.hide();
    if (isLoading) {
      $loadingMessages.show();
    } else {
      if (displayedPostCount < totalBlogPosts) {
        $loadMoreButtons.show();
      } else if (totalBlogPosts > 0) {
        $noMoreMessages.show();
      }
    }
    $loadMoreButtons.prop('disabled', isLoading);
    $("#newerLoadMoreContainerTop").toggle(totalBlogPosts > featuredPostCount);
    $("#newerLoadMoreContainerBottom").toggle(totalBlogPosts > 0);
  }




  function newerHandleFeedData(json) {
    isLoading = false;
    const newerSliderArea = $("#newerSliderItemsAreaElement");
    try {
      if (!json || !json.feed) {
        if (allPosts.length === 0) newerSliderArea.html('<div class="newer-feedback-message">لا توجد مقالات لعرضها حاليا&#1611;.</div>');
        totalBlogPosts = allPosts.length;
        return;
      }
      if (totalBlogPosts === 0 && json.feed.openSearch$totalResults?.$t) {
        totalBlogPosts = parseInt(json.feed.openSearch$totalResults.$t, 10) || 0;
      }
      const newEntries = json.feed.entry || [];
      const newPosts = newEntries.map(newerExtractPostDetailsFromFeedEntry).filter(p => p !== null);
      if (newPosts.length > 0) {
        allPosts = allPosts.concat(newPosts);
        const nextLink = json.feed.link?.find(link => link.rel === 'next');
        nextStartIndex = nextLink ? new URL(nextLink.href).searchParams.get('start-index') : null;
        if (displayedPostCount === 0) {
          const specialPosts = allPosts.slice(0, featuredPostCount);
          let finalHtml = '';
          if (specialPosts.length > 0) {
            let specialGridHtml = '<div class="newer-special-layout-grid">';
            if (specialPosts[0]) specialGridHtml += newerRenderFeaturedSlider(specialPosts[0]);
            for (let i = 1; i < specialPosts.length; i++) {
              if (specialPosts[i]) specialGridHtml += newerRenderSlider(specialPosts[i]);
            }
            specialGridHtml += '</div>';
            finalHtml += specialGridHtml;
            displayedPostCount = specialPosts.length;
            if (displayedPostCount >= totalBlogPosts) nextStartIndex = null;
          }
          const loadMoreContainerHtml = idSuffix => `<div class="newer-load-more-container" id="newerLoadMoreContainer${idSuffix}"><button class="newer-load-more-button">المزيد من الموضوعات</button><div class="newer-loading-message" style="display:none;">جار&#1613; التحميل...</div><div class="newer-no-more-posts" style="display:none;">لا توجد المزيد من الموضوعات.</div></div>`;
          if (totalBlogPosts > featuredPostCount) finalHtml += loadMoreContainerHtml("Top");
          let regularItemsHtml = '';
          const remainingInitialBatch = allPosts.slice(displayedPostCount);
          remainingInitialBatch.forEach(post => { regularItemsHtml += newerRenderSlider(post); });
          finalHtml += `<div class="newer-regular-items-grid">${regularItemsHtml}</div>`;
          displayedPostCount += remainingInitialBatch.length;
          if (totalBlogPosts > 0) finalHtml += loadMoreContainerHtml("Bottom");
          newerSliderArea.html(finalHtml);
        } else {
          let newBatchHtml = '';
          newPosts.forEach(post => { newBatchHtml += newerRenderSlider(post); });
          $(".newer-regular-items-grid").append(newBatchHtml);
          displayedPostCount += newPosts.length;
        }
      } else {
        nextStartIndex = null;
        if (allPosts.length === 0) newerSliderArea.html('<div class="newer-feedback-message">لا توجد مقالات لعرضها حاليا&#1611;.</div>');
        totalBlogPosts = allPosts.length;
      }
    } catch (e) {
      console.error("Error processing feed data:", e, json);
      newerSliderArea.append('<div class="newer-feedback-message newer-error-message">حدث خطأ أثناء عرض المقالات.</div>');
      nextStartIndex = null;
      totalBlogPosts = allPosts.length;
    } finally {
      newerUpdateLoadMoreState();
    }
  }




  function newerFetchPosts(startIndex, count, categorySlug = null) {
    const blogUrl = window.location.origin;
    let feedUrl = `${blogUrl}/feeds/posts/default`;
    if (categorySlug) feedUrl += `/-/${encodeURIComponent(categorySlug)}`;
    feedUrl += `?alt=json-in-script&max-results=${count}&start-index=${startIndex}&orderby=published`;
    return $.ajax({ url: feedUrl, dataType: "jsonp", timeout: 15000 });
  }




  function newerLoadNextBatchFromFeed() {
    if (isLoading || !nextStartIndex) return;
    const currentPath = window.location.pathname;
    const isCategoryPage = currentPath.includes("/search/label/");
    let categorySlug = null;
    if (isCategoryPage) {
      categorySlug = decodeURIComponent(currentPath.split("/search/label/")[1].split("?")[0].replace(/\+/g, " "));
    }
    isLoading = true;
    newerUpdateLoadMoreState();
    newerFetchPosts(nextStartIndex, postsPerBatch, categorySlug)
      .done(newerHandleFeedData)
      .fail(function() {
        console.error("AJAX error fetching next batch feed.");
        $("#newerSliderItemsAreaElement").append('<div class="newer-feedback-message newer-error-message">فشل في تحميل المزيد من المقالات.</div>');
        isLoading = false;
        nextStartIndex = null;
        totalBlogPosts = allPosts.length;
        newerUpdateLoadMoreState();
      });
  }
  
  const newerApplyTheme = () => {
    try {
      const rootStyle = document.documentElement.style;
      const blogColor = newerGetMetaContent("blogcolor");
      if (blogColor) rootStyle.setProperty("--blogcolor", blogColor);
      const solidColor = newerGetMetaContent("solidcolor");
      if (solidColor) rootStyle.setProperty("--solidcolor", solidColor);
      const softColor = newerGetMetaContent("softcolor");
      if (softColor) rootStyle.setProperty("--softcolor", softColor);
    } catch (e) { console.warn("Theme color error:", e); }
  };
 
  function runInitialLoad(categorySlug = null) {
    allPosts = [];
    displayedPostCount = 0;
    totalBlogPosts = 0;
    nextStartIndex = 1;
    $("#newerSliderItemsAreaElement").html('<div class="newer-feedback-message">جار&#1613; تحميل المقالات...</div>');
    isLoading = true;
    newerUpdateLoadMoreState();
    newerFetchPosts(1, initialLoadCount, categorySlug)
      .done(newerHandleFeedData)
      .fail(function() {
        console.error("AJAX error fetching initial feed.");
        $("#newerSliderItemsAreaElement").html('<div class="newer-feedback-message newer-error-message">فشل في تحميل المقالات الأولية.</div>');
        isLoading = false;
        nextStartIndex = null;
        totalBlogPosts = 0;
        newerUpdateLoadMoreState();
      });
  }




  function initializeNewerSlider() {
    if (!shouldDisplayWidget()) {
      $(".newer-slider-wrapper").remove();
      return;
    }
    const newerMainContainer = $("#newerSliderContainer");
    const currentPath = window.location.pathname;
    const isCategoryPage = currentPath.includes("/search/label/");
    let categorySlug = isCategoryPage ? decodeURIComponent(currentPath.split("/search/label/")[1].split("?")[0].replace(/\+/g, " ")) : null;
    
    newerApplyTheme();
    newerGetCategoryTranslations();
    newerSetWidgetTitleAndDescription();
    
    runInitialLoad(categorySlug);
    
    $(document).on("click", ".newer-load-more-button", newerLoadNextBatchFromFeed);
    
    $(window).on("popstate", function() {
      if (shouldDisplayWidget()) {
        newerMainContainer.show();
        const path = window.location.pathname;
        const isCat = path.includes("/search/label/");
        const slug = isCat ? decodeURIComponent(path.split("/search/label/")[1].split("?")[0].replace(/\+/g, " ")) : null;
        newerSetWidgetTitleAndDescription();
        runInitialLoad(slug);
      } else {
        newerMainContainer.hide();
      }
    });
  }




  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeNewerSlider);
  } else {
    initializeNewerSlider();
  }




})(jQuery);