"""
URL configuration for backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path

from auths import views as auths_views
from catalog import views as catalog_views
from orders import finance as orders_finance
from orders import views as orders_views
from stores import views as stores_views
from subscriptions import views as subscriptions_views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/login/', auths_views.login_view),
    path('api/me/', auths_views.me_view),
    path('api/profile/', auths_views.profile_view),
    path('api/logout/', auths_views.logout_view),
    path('api/register/request/', auths_views.register_request_view),
    path('api/register/verify/', auths_views.register_verify_view),
    path('api/register/complete/', auths_views.register_complete_view),
    path('api/vendor/products/', catalog_views.vendor_listings_view),
    path('api/catalog/', catalog_views.public_catalog_view),
    path('api/orders/quick/', orders_views.quick_order_view),
    path('api/orders/quick/<uuid:order_id>/', orders_views.quick_order_status_view),
    path('api/vendor/orders/', orders_views.vendor_orders_view),
    path('api/vendor/dashboard/', orders_views.vendor_dashboard_view),
    path('api/admin/users/', auths_views.admin_users_view),
    path('api/admin/users/<uuid:user_id>/', auths_views.admin_user_update_view),
    path('api/admin/users/<uuid:user_id>/password/', auths_views.admin_user_password_view),
    path('api/admin/stores/', stores_views.admin_stores_view),
    path('api/admin/stores/<uuid:store_id>/', stores_views.admin_store_update_view),
    path('api/admin/products/', catalog_views.admin_products_view),
    path('api/admin/products/<uuid:listing_id>/', catalog_views.admin_product_update_view),
    path('api/admin/orders/', orders_views.admin_orders_view),
    path('api/admin/orders/<uuid:order_id>/', orders_views.admin_order_detail_view),
    path('api/admin/orders/<uuid:order_id>/sourcing/', orders_views.admin_order_sourcing_view),
    path('api/admin/orders/<uuid:order_id>/purchase-orders/', orders_views.admin_create_purchase_order_view),
    path('api/admin/purchase-orders/<uuid:po_id>/', orders_views.admin_purchase_order_detail_view),
    path('api/admin/finance/', orders_finance.admin_finance_view),
    path('api/admin/dashboard/', orders_finance.admin_dashboard_view),
    path('api/admin/revenue/', subscriptions_views.admin_revenue_view),
    path('api/admin/revenue/invoices/<uuid:invoice_id>/', subscriptions_views.admin_revenue_invoice_view),
    path('api/admin/revenue/stores/<uuid:store_id>/plan/', subscriptions_views.admin_store_plan_view),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
